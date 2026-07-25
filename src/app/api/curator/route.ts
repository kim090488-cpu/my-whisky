import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `당신은 위스키 큐레이터이자 애호가입니다. 한국어로 친근하게 답변하되 정확하고 실용적인 정보를 제공하세요.

가이드:
- 위스키 추천 시 예산·취향·용도(입문/가성비/선물/특별한 날)를 물어보거나 감안
- 스카치·아이리시·재패니즈·미국·기타 지역 특징 언급
- 초보자에겐 어려운 용어(피트, 노즈, 피니시) 짧게 설명
- 확실하지 않으면 "제 지식으로는 정확하지 않을 수 있어요"라고 명시
- 답변은 3~6문장 정도로 간결하게. 리스트로 추천 시 3~5개
- 술 자체를 권하기보다 정보 공유·비교·경험 관점

절대 하지 말 것:
- 미성년자 음주 조장
- 특정 상표 편향적 광고
- 의학적/법적 조언`;

export async function POST(request: Request) {
  const supabase = await createClient();
  // 모바일은 Authorization header, 웹은 cookie 기반. 둘 다 시도.
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: { user } } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const limit = rateLimit(`curator:${user.id}`, { max: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `너무 빠른 요청이에요. ${Math.ceil(limit.retryAfterMs / 1000)}초 후 다시 시도해주세요.` },
      { status: 429 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }

  let body: { messages?: Array<{ role: "user" | "assistant"; content: string }>; prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : (body.prompt ? [{ role: "user" as const, content: body.prompt }] : []);
  if (messages.length === 0) {
    return NextResponse.json({ error: "prompt or messages required" }, { status: 400 });
  }

  // 마지막 10 turn만 유지 (context 절약)
  const trimmed = messages.slice(-10).map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content.slice(0, 4000) : "",
  }));

  const client = new Anthropic({ apiKey });
  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: trimmed,
    });
    const text = resp.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    return NextResponse.json({ reply: text }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Claude call failed" },
      { status: 502 },
    );
  }
}
