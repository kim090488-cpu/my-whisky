import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountForm } from "./delete-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "계정 삭제",
};

export default async function DeleteAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const username = profile?.username ?? user.email ?? "";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:py-14">
      <nav className="mb-6 text-xs text-muted-foreground">
        <Link href="/me" className="hover:text-foreground">
          내 프로필
        </Link>{" "}
        · 계정 삭제
      </nav>

      <h1 className="font-serif text-3xl tracking-tight">계정 삭제</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        아래 내용을 확인한 뒤 삭제하세요. 삭제는 즉시 반영되며 되돌릴 수 없습니다.
      </p>

      <section className="mt-8 rounded-xl border border-rose-500/30 bg-rose-500/5 p-5 text-sm">
        <h2 className="text-sm font-semibold text-rose-300">즉시 삭제되는 데이터</h2>
        <ul className="mt-3 space-y-1.5 text-foreground/85">
          <li>· 프로필 정보 (사용자명·표시명·자기소개·아바타)</li>
          <li>· 모든 테이스팅 노트·평점·첨부 사진</li>
          <li>· 컬렉션 항목(소유·오픈·소진·위시리스트)</li>
          <li>· 커뮤니티 게시글·댓글·좋아요·팔로우 관계</li>
          <li>· AI 큐레이터 대화 기록</li>
          <li>· 푸시 알림 구독 및 알림 내역</li>
          <li>· 신고·차단 이력</li>
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-card/40 p-5 text-sm">
        <h2 className="text-sm font-semibold text-foreground">보존되는 데이터</h2>
        <ul className="mt-3 space-y-1.5 text-muted-foreground">
          <li>
            · 위스키 카탈로그(bottling)에 기여한 편집 이력 — 카탈로그 무결성을 위해 작성자를
            익명 처리(created_by = null)하여 유지
          </li>
          <li>
            · 법령상 보관 의무가 있는 서버 접근 로그 — 위탁 사업자(Vercel/Supabase) 정책에 따라
            보관 후 파기
          </li>
        </ul>
      </section>

      <DeleteAccountForm username={username} />
    </main>
  );
}
