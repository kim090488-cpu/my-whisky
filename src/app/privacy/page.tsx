import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description: "my-whisky 서비스의 개인정보 수집·이용·보관·파기 방침",
};

const LAST_UPDATED = "2026-08-07";
const CONTACT_EMAIL = "kim090488@gmail.com";

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8 border-b border-border/60 pb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">개인정보 처리방침</h1>
        <p className="mt-2 text-sm text-muted-foreground">최종 갱신일: {LAST_UPDATED}</p>
      </header>

      <div className="space-y-8 text-sm leading-7 text-foreground/90 sm:text-[15px]">
        <p>
          my-whisky(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 소중히 다루며, 대한민국 개인정보 보호법을 준수합니다.
          본 방침은 서비스가 수집하는 정보의 종류·이용 목적·보관·제3자 제공·이용자 권리를 안내합니다.
        </p>

        <Section title="1. 수집하는 개인정보">
          <List
            items={[
              <><b>계정 정보</b> — 이메일 주소, OAuth 공급자(Google 또는 Kakao)에서 제공하는 프로필 이미지·이름</>,
              <><b>프로필 정보</b> — 사용자가 직접 입력하는 표시명(display name), 사용자명(username), 프로필 사진, 자기소개</>,
              <><b>서비스 이용 기록</b> — 테이스팅 노트·점수·사진, 컬렉션(소유·오픈·소진·위시리스트), 좋아요·댓글·팔로우, 커뮤니티 게시글, AI 큐레이터 대화 기록, 위스키 카탈로그 편집 이력</>,
              <><b>기기 정보</b> — 푸시 알림 전송을 위한 Expo/FCM 푸시 토큰, 앱 버전, OS 종류</>,
              <><b>카메라</b> — 위스키 바코드 스캔 시에만 이미지가 실시간 처리되며, 스캔 결과(바코드 문자열)만 저장되고 이미지는 저장되지 않습니다</>,
              <><b>갤러리</b> — 사용자가 테이스팅에 첨부하기로 선택한 사진만 서비스로 업로드됩니다</>,
            ]}
          />
        </Section>

        <Section title="2. 이용 목적">
          <List
            items={[
              "회원 식별 및 로그인 인증",
              "테이스팅·컬렉션·소셜 기능 제공 및 유지",
              "AI 큐레이터가 개인화된 추천을 제공하기 위해 사용자의 취향 프로필(선호 풍미·평균 점수·즐겨 마시는 위스키 종류)을 컨텍스트로 활용",
              "푸시 알림(좋아요·댓글·팔로우·시스템 공지)",
              "위스키 카탈로그의 위키 스타일 협업 기여 이력 관리",
              "서비스 개선을 위한 익명 통계 분석",
            ]}
          />
        </Section>

        <Section title="3. 제3자 처리 위탁">
          <p>서비스 운영을 위해 다음 사업자에게 개인정보 처리를 위탁합니다.</p>
          <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3 font-medium">위탁받는 자</th>
                  <th className="p-3 font-medium">위탁 목적</th>
                  <th className="p-3 font-medium">전달 정보</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <Row who="Supabase Inc." what="계정 인증·DB·파일 저장·백엔드 API" data="위 1항 전체" />
                <Row who="Anthropic PBC" what="AI 큐레이터 응답 생성 (Claude API)" data="사용자 질의문, 취향 프로필 요약 (익명 처리된 통계값)" />
                <Row who="Google Firebase" what="Android 푸시 알림 전송" data="푸시 토큰, 알림 페이로드" />
                <Row who="Expo (Expo Push Service)" what="푸시 알림 라우팅" data="Expo 푸시 토큰" />
                <Row who="Vercel Inc." what="웹 서비스 호스팅·CDN" data="접속 IP·User-Agent(웹 서버 로그 표준)" />
                <Row who="Google LLC · Kakao Corp." what="OAuth 로그인 공급자" data="이메일, 공개 프로필" />
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="4. 보관 기간">
          <List
            items={[
              "회원 정보 및 사용자 생성 콘텐츠는 계정이 유지되는 동안 보관됩니다.",
              "계정 삭제 시 관련 데이터(테이스팅·컬렉션·댓글·좋아요·팔로우·커뮤니티 게시글·큐레이터 대화)는 즉시 cascade 삭제됩니다.",
              "위스키 카탈로그(bottling)에 대한 위키 스타일 기여 기록은 저작자를 익명화(created_by = null)한 상태로 카탈로그 무결성을 위해 유지될 수 있습니다.",
              "법령상 보관이 의무화된 로그(예: 웹 서버 접근 로그)는 해당 기간 동안 위탁 사업자의 정책에 따라 보관 후 파기됩니다.",
            ]}
          />
        </Section>

        <Section title="5. 이용자의 권리">
          <List
            items={[
              "언제든 서비스 내에서 프로필·테이스팅·컬렉션·게시글을 조회·수정·삭제할 수 있습니다.",
              <>
                &ldquo;내 정보&rdquo; 화면 하단의 &ldquo;계정 삭제&rdquo; 항목(웹은{" "}
                <a href="/me/settings/delete-account" className="text-primary underline underline-offset-4">/me/settings/delete-account</a>,
                별도 안내는 <a href="/account/delete" className="text-primary underline underline-offset-4">/account/delete</a>)에서 직접 삭제할 수 있으며, 삭제 시 위 4항의 절차에 따라 처리됩니다.
              </>,
              <>개인정보 열람·정정·삭제·처리정지 요청은 아래 문의처로 접수됩니다. <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-4">{CONTACT_EMAIL}</a></>,
            ]}
          />
        </Section>

        <Section title="6. 안전성 확보 조치">
          <List
            items={[
              "전송 구간 TLS 암호화",
              "Supabase Row Level Security(RLS)로 사용자별 데이터 접근 통제",
              "OAuth PKCE 흐름을 통한 인증 토큰 보호, 기기 내 SecureStore 저장",
              "관리자 권한 최소화 및 접근 감사",
            ]}
          />
        </Section>

        <Section title="7. 만 14세 미만 아동">
          <p>
            서비스는 주류 관련 콘텐츠를 다루므로 만 14세 미만 아동을 대상으로 하지 않습니다. 만 14세 미만으로 확인된 계정은
            즉시 삭제됩니다.
          </p>
        </Section>

        <Section title="8. 방침 변경">
          <p>
            본 방침은 법령·서비스 정책 변경에 따라 갱신될 수 있으며, 변경 시 서비스 내 공지 또는 이메일로 알립니다.
            중대한 변경의 경우 시행 7일 전부터 공지합니다.
          </p>
        </Section>

        <Section title="9. 문의처">
          <p>
            개인정보 관련 문의는 <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-4">{CONTACT_EMAIL}</a> 로 연락 주시기 바랍니다.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Row({ who, what, data }: { who: string; what: string; data: string }) {
  return (
    <tr>
      <td className="p-3 align-top font-medium">{who}</td>
      <td className="p-3 align-top text-muted-foreground">{what}</td>
      <td className="p-3 align-top text-muted-foreground">{data}</td>
    </tr>
  );
}
