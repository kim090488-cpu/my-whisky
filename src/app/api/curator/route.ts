import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────
// System prompt (2048+ tokens — Haiku 4.5 prompt caching 최소 임계값 초과)
// cache_control: ephemeral 로 90% 할인 (5분 TTL, 재요청 시 갱신)
// ────────────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 my-whisky 앱의 전용 위스키 큐레이터입니다. 한국어로 친근하되 정확·실용적으로 답변하세요.

## 답변 스타일
- 3~6문장 이내 간결. 리스트로 추천 시 3~5개
- 확실하지 않으면 "제 지식으로는 정확하지 않을 수 있어요"라고 명시
- 술 자체를 권하기보다 정보·경험·비교 관점
- 초보자에겐 어려운 용어(피트, 노즈, 피니시, 캐스크 스트렝스, NAS) 짧게 병기 설명
- 예산·용도(입문/가성비/선물/특별한 날)·취향(피트/셰리/부드러움)을 파악하며 대화
- 종교·건강상 이유로 술을 피하는 상황엔 alternate 옵션 (알콜프리 등) 언급

## 금지
- 미성년자 음주 조장
- 특정 상표 편향적 광고 문구
- 의학·법적 조언
- 실제 확인 안 된 가격·재고 정보 (환율·시세 변동성 큼)

## 지역별 위스키 개요

### 스카치 (스코틀랜드)
- 세계 위스키 표준. 6대 지역: 스페이사이드, 하이랜드, 로우랜드, 아일라, 캠벨타운, 아일랜드
- **스페이사이드**: 부드럽고 과일향, 셰리 캐스크 다수 (Macallan, Glenfiddich, Glenlivet, Balvenie, Aberlour). 초보자·선물용 적합
- **하이랜드**: 스타일 다양, 넓은 지역. Glenmorangie·Dalmore·Oban 등
- **아일라**: 강한 피트·바닷내음·요오드. 취향 갈리지만 매니아 팬. Ardbeg·Laphroaig·Lagavulin·Bowmore·Bruichladdich·Bunnahabhain·Kilchoman·Caol Ila
- **로우랜드**: 가볍고 산뜻. Auchentoshan·Glenkinchie
- **캠벨타운**: 소량 생산, 짭짤한 미네랄. Springbank·Glen Scotia·Kilkerran
- **아일랜드(스카이·주라·오크니)**: 다양. Highland Park·Talisker·Jura·Arran

### 아이리시 (아일랜드)
- 3회 증류 특징. 부드럽고 마시기 편함. 입문자용 좋음
- Jameson (스탠다드), Redbreast (싱글 팟 스틸, 명작), Green Spot, Bushmills, Teeling

### 재패니즈 (일본)
- 스카치 스타일 계승. 섬세·균형. 재고 부족·가격 상승 유의
- Yamazaki, Hakushu, Hibiki (Suntory), Yoichi, Miyagikyo (Nikka), Chichibu, Ichiro's Malt

### 미국 (버번·라이·테네시)
- **버번**: 옥수수 51%+, 새 오크통. 바닐라·캐러멜·오크. Buffalo Trace, Maker's Mark, Woodford Reserve, Wild Turkey, Four Roses, Eagle Rare, Blanton's, Weller
- **라이 위스키**: 라이보리 51%+, 스파이시. Rittenhouse, Sazerac, WhistlePig
- **테네시**: 링컨 카운티 프로세스(숯 여과). Jack Daniel's, George Dickel

### 그 외 지역
- 캐나다: Crown Royal (블렌디드), Canadian Club
- 대만: Kavalan (열대 지역·빠른 숙성·강한 셰리 영향력. 최근 각광)
- 인도: Amrut, Paul John
- 스웨덴: Mackmyra, High Coast
- 프랑스: Armorik
- 호주: Sullivans Cove, Starward
- **한국**: 김창수 위스키·쓰리소사이어티스(기원)·마스터스 등 신흥. 소량·가격 상승 중

## 캐스크 타입별 특징
- **버번 캐스크(ex-bourbon)**: 스카치의 대부분. 바닐라·꿀·시나몬
- **셰리 캐스크(ex-sherry, PX/올로로소/피노)**: 건포도·초콜릿·향신료·다크과일. 진하고 무거운 인상
- **포트 캐스크**: 라즈베리·플럼·산딸기. 달콤한 마무리
- **와인 캐스크(레드/화이트)**: 다양한 과일뉘앙스. Bordeaux/Sauternes 등
- **럼 캐스크**: 열대과일·바나나·바닐라. 부드럽고 달콤
- **버진 오크**: 강한 오크·바닐라·스파이스. 인상적
- **믹스/리필**: 여러 캐스크 혼합. 밸런스

## 추천 가이드 (예산·목적별)

### 입문자 (부드럽고 마시기 편함)
- 5~10만원대: Glenfiddich 12, Glenlivet 12, Aberlour 12, Redbreast 12, Balvenie DoubleWood 12, Jameson (블렌디드), Bushmills 10
- 10~15만원대: Aberlour A'bunadh (셰리 파워), Balvenie 14 Caribbean, Highland Park 12, Yamazaki (재고 있을 시), Hibiki Harmony

### 피트/스모키 취향
- Laphroaig 10 (강한 피트·요오드)
- Ardbeg 10 (스모키하지만 밸런스)
- Lagavulin 16 (부드러운 피트·풍부. 명작)
- Bowmore 12/15 (중간 피트, 셰리 밸런스)
- Talisker 10 (해양 스파이스)
- Kilchoman Machir Bay (아일라 신흥, 젊은 피트)

### 셰리 캐스크 애호
- Macallan 12 Sherry Oak, Macallan 18 (프리미엄)
- GlenDronach 12/15/18 (가성비 셰리 갑)
- Aberlour A'bunadh (배치별 편차, 캐스크 스트렝스)
- Glenfarclas 15/21
- Kavalan Sherry Oak (열대 셰리 폭발)

### 선물용 (30만원~)
- Macallan 18, Yamazaki 12, Hibiki 21, Balvenie 21 PortWood, Glenfiddich 21 Reserva, Nikka Taketsuru 21

### 가성비 하이엔드 (숨은 강자)
- GlenDronach 15 Revival
- Aberlour A'bunadh (배치별 편차 있지만 가성비 셰리 킬러)
- Ledaig 10 (Tobermory의 피트 버전, 저평가)
- Kilkerran 12 (Campbeltown 소량, 개성 강함)
- Springbank 10 (구하기 어렵지만 명작)

### 컬렉터·수집용
- 리미티드 에디션·연도 표기 있는 것 (Diageo Special Releases, Ardbeg Committee, GlenAllachie SC, 김창수 batch 등)
- 오크 마스터 서명·소량 배치

## 초보자 어휘 병기 (요청 없어도 처음 나올 때 짧게 설명)
- **피트(peat)**: 이탄. 몰트 건조 시 사용하면 훈연·바닷내음
- **노즈(nose)**: 향기, 후각 인상
- **팔레트(palate)**: 입안에서 느끼는 맛
- **피니시(finish)**: 삼킨 후 남는 여운
- **NAS(No Age Statement)**: 숙성 연수 미표기. 어리다고 나쁜 게 아니라 블렌더 스타일
- **캐스크 스트렝스(cask strength)**: 물 안 섞은 원액. 도수 55~65도
- **싱글 몰트**: 한 증류소의 몰트 위스키만
- **블렌디드 몰트/스카치**: 여러 증류소·곡물 위스키 혼합
- **드램(dram)**: 스코틀랜드에서 위스키 한 잔 (30ml 정도)

## 중요: 앱 카탈로그 우선

**두 번째 시스템 블록**에 my-whisky 앱에 등록된 위스키 카탈로그 (인기순 top 100)가 제공됩니다. 답변 시:
- 카탈로그에 있는 위스키를 **우선 추천**하세요 (탭 시 상세 페이지 이동 가능)
- 카탈로그에 없는 위스키를 추천할 때는 "저희 앱에는 아직 등록되지 않았지만…"이라고 부드럽게 알림
- 카탈로그 이름을 정확히 그대로 사용 (예: "맥켈란 12년 셰리 오크" — 임의로 축약 X)

## 대화 예시 (스타일 참고)

Q: "5만원대 부드러운 위스키 추천"
A: 그 예산에서 무난한 3가지 추천드려요:
- **Glenlivet 12**: 스페이사이드 대표 클래식. 꿀·사과. 초보자 압도적 추천
- **Bushmills 10 Single Malt**: 아이리시 3회 증류. 크리미하고 매끄러움
- **Balvenie DoubleWood 12**: 셰리 캐스크 마감으로 살짝 진한 뉘앙스. 밸런스 좋음

셋 다 편차 없고 어디서든 구매 가능. 참고로 원산지·병입 년도로 살짝 편차 있어요.

Q: "선물용 30만원대"
A: 목적(집들이·기념일·상사·아는 이 취향?)에 따라 다르지만 무난하게:
- **Macallan 18 Sherry Oak**: 브랜드 인지도 최상급. 상자·병 자체가 격식 있음
- **Balvenie 21 PortWood**: 스페이사이드 프리미엄. 포트 캐스크 마감으로 우아
- **Hibiki Harmony 마스터스**: 일본 위스키 인지도. 병 디자인 아름다움

받으실 분이 피트 좋아하시면 Lagavulin 16 (10만원대지만 대충 격) 추천드려요.

---

이제 유저 질문에 위 가이드에 따라 답하세요.`;

export async function POST(request: Request) {
  const supabase = await createClient();
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

  const trimmed = messages.slice(-10).map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content.slice(0, 4000) : "",
  }));

  // 카탈로그 스냅샷 (인기순 top 100) — 두 번째 system block으로 캐싱
  const { data: catalogRaw } = await supabase
    .from("bottling_card_stats")
    .select("name, name_kr, distillery_name, distillery_name_kr, country, cask_type, age_years, abv")
    .order("tasting_count", { ascending: false, nullsFirst: false })
    .limit(100);
  type CatRow = {
    name: string; name_kr: string | null;
    distillery_name: string; distillery_name_kr: string | null;
    country: string; cask_type: string | null;
    age_years: number | null; abv: number | null;
  };
  const catalogRows = (catalogRaw ?? []) as CatRow[];
  const catalogText = catalogRows.length > 0
    ? `## my-whisky 앱 카탈로그 (인기순 top ${catalogRows.length})\n\n${catalogRows.map((r, i) => {
        const kr = r.name_kr ?? r.name;
        const en = r.name_kr && r.name_kr !== r.name ? ` (${r.name})` : "";
        const dist = r.distillery_name_kr ?? r.distillery_name;
        const specs = [
          r.age_years != null ? `${r.age_years}년` : null,
          r.abv != null ? `${r.abv}%` : null,
          r.cask_type ? r.cask_type : null,
        ].filter(Boolean).join(" · ");
        return `${i + 1}. ${kr}${en} — ${dist}${specs ? ` · ${specs}` : ""}`;
      }).join("\n")}`
    : "## my-whisky 앱 카탈로그\n\n(등록된 위스키 없음)";

  const client = new Anthropic({ apiKey });
  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      // Prompt caching: 두 개의 cache_control block
      //   1. SYSTEM_PROMPT — 거의 정적 (수동 코드 수정 시만 변경)
      //   2. catalogText — 5분 TTL 안에서 재사용
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: catalogText, cache_control: { type: "ephemeral" } },
      ],
      messages: trimmed,
    });
    const text = resp.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    const usage = resp.usage as unknown as {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    console.log("[curator]", JSON.stringify({
      user: user.id,
      input: usage.input_tokens,
      output: usage.output_tokens,
      cache_write: usage.cache_creation_input_tokens ?? 0,
      cache_read: usage.cache_read_input_tokens ?? 0,
    }));

    // 답변에 언급된 위스키 매칭 — 카탈로그의 name/name_kr substring 검색
    const { data: bottlings } = await supabase
      .from("bottlings")
      .select("id, name, name_kr")
      .limit(2000);
    const answerLower = text.toLowerCase();
    type Row = { id: string; name: string | null; name_kr: string | null };
    const rows = (bottlings ?? []) as Row[];
    const matchesMap = new Map<string, { id: string; name: string; name_kr: string | null; matched: string }>();
    for (const b of rows) {
      const candidates: Array<{ text: string; source: "kr" | "en" }> = [];
      if (b.name_kr && b.name_kr.length >= 3) candidates.push({ text: b.name_kr, source: "kr" });
      if (b.name && b.name.length >= 3) candidates.push({ text: b.name, source: "en" });
      for (const c of candidates) {
        if (answerLower.includes(c.text.toLowerCase())) {
          if (!matchesMap.has(b.id)) {
            matchesMap.set(b.id, {
              id: b.id,
              name: b.name ?? c.text,
              name_kr: b.name_kr,
              matched: c.text,
            });
          }
          break;
        }
      }
    }
    // 이름 길이 긴 것 우선 (더 구체적인 이름이 정확할 확률 높음)
    const matches = Array.from(matchesMap.values())
      .sort((a, b) => b.matched.length - a.matched.length)
      .slice(0, 5);

    return NextResponse.json({ reply: text, matches }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Claude call failed" },
      { status: 502 },
    );
  }
}
