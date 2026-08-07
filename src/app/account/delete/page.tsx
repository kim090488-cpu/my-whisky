import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "계정 및 데이터 삭제",
  description: "my-whisky 계정과 관련 데이터를 삭제하는 방법 안내",
};

const APP_NAME = "my-whisky";
const DEVELOPER_NAME = "kimsunghun (my-whisky)";
const CONTACT_EMAIL = "kim090488@gmail.com";
const LAST_UPDATED = "2026-08-07";

export default function AccountDeletePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8 border-b border-border/60 pb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">계정 및 데이터 삭제</h1>
        <p className="mt-2 text-sm text-muted-foreground">최종 갱신일: {LAST_UPDATED}</p>
      </header>

      <div className="space-y-8 text-sm leading-7 text-foreground/90 sm:text-[15px]">
        <section className="rounded-lg border border-border/60 bg-card/40 p-4">
          <p>
            <b>앱</b>: {APP_NAME}
          </p>
          <p className="mt-1">
            <b>개발자</b>: {DEVELOPER_NAME}
          </p>
          <p className="mt-1">
            <b>문의</b>:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-primary underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">삭제 방법 1 · 앱 내에서 직접 삭제</h2>
          <ol className="list-decimal space-y-2 pl-5 marker:text-muted-foreground">
            <li>
              앱 실행 후 로그인 →{" "}
              <b>내 정보(하단 탭)</b> 화면으로 이동
            </li>
            <li>
              화면 하단 &ldquo;<b>계정 삭제</b>&rdquo; 항목을 탭
            </li>
            <li>
              안내 문구를 확인한 뒤 입력란에 <b>삭제</b>를 입력
            </li>
            <li>
              <b>계정 영구 삭제</b> 버튼을 누르면 즉시 반영
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            웹(브라우저) 이용자는{" "}
            <Link
              href="/me/settings/delete-account"
              className="text-primary underline underline-offset-4"
            >
              /me/settings/delete-account
            </Link>{" "}
            에서 동일한 절차로 진행할 수 있습니다.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">삭제 방법 2 · 이메일 요청</h2>
          <p>
            앱에 접근할 수 없거나 대신 요청하고 싶은 경우, 아래 이메일로 삭제를 요청해 주세요.
            영업일 기준 <b>7일 이내</b>에 처리합니다.
          </p>
          <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">
            <li>
              수신:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=my-whisky%20계정%20삭제%20요청`}
                className="text-primary underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              제목: <code>my-whisky 계정 삭제 요청</code>
            </li>
            <li>
              본문에 포함할 정보: 가입에 사용한 이메일 주소, 앱 내 사용자명(@handle, 아는 경우)
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">즉시 삭제되는 데이터</h2>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
            <li>계정 자격증명(이메일·OAuth 연동 정보)</li>
            <li>프로필 정보(사용자명·표시명·자기소개·아바타)</li>
            <li>모든 테이스팅 노트·평점·첨부 사진 (Supabase Storage에서 파일 물리 삭제)</li>
            <li>컬렉션 항목(소유·오픈·소진·위시리스트)</li>
            <li>커뮤니티 게시글·모먼트·댓글·좋아요·팔로우 관계</li>
            <li>AI 큐레이터 대화 기록</li>
            <li>푸시 알림 구독·수신 알림 내역</li>
            <li>신고·차단 이력</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">보존되는 데이터 및 사유</h2>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
            <li>
              위스키 카탈로그(bottling)에 대한 위키 스타일 기여 이력은 카탈로그 무결성을 위해
              작성자를 익명 처리(created_by = null)하여 유지됩니다. 개인 식별 정보는 남지 않습니다.
            </li>
            <li>
              법령상 보관이 의무화된 서버 접근 로그(예: 웹 서버 표준 access log)는 위탁 사업자
              (Vercel·Supabase) 정책에 따라 최대 <b>3개월</b>간 보관 후 자동 파기됩니다.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">추가 안내</h2>
          <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
            <li>삭제는 <b>즉시</b> 반영되며 되돌릴 수 없습니다.</li>
            <li>
              동일한 OAuth 계정(Google/Kakao)으로 다시 로그인하면 <b>새로운 빈 계정</b>이 생성됩니다.
              이전 데이터는 복원되지 않습니다.
            </li>
            <li>
              전체 개인정보 처리 방침은{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-4">
                /privacy
              </Link>{" "}
              를 참고하세요.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
