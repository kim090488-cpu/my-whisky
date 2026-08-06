import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 · my-whisky",
  description: "my-whisky 서비스 이용약관",
};

const EFFECTIVE_DATE = "2026-08-07";
const CONTACT_EMAIL = "kim090488@gmail.com";

export default function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8 border-b border-border/60 pb-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">이용약관</h1>
        <p className="mt-2 text-sm text-muted-foreground">시행일: {EFFECTIVE_DATE}</p>
      </header>

      <div className="space-y-8 text-sm leading-7 text-foreground/90 sm:text-[15px]">
        <Section title="제1조 (목적)">
          <p>
            본 약관은 my-whisky(이하 &ldquo;서비스&rdquo;)가 제공하는 위스키 커뮤니티 및 관련 부가 서비스의 이용과 관련하여
            서비스와 이용자 간의 권리·의무·책임사항을 규정함을 목적으로 합니다.
          </p>
        </Section>

        <Section title="제2조 (정의)">
          <List
            items={[
              <><b>&ldquo;서비스&rdquo;</b>란 my-whisky 웹사이트 및 모바일 애플리케이션을 통해 제공되는 모든 기능(테이스팅 노트 기록, 컬렉션 관리, 커뮤니티, AI 큐레이터, 위스키 카탈로그 기여 등)을 말합니다.</>,
              <><b>&ldquo;이용자&rdquo;</b>란 본 약관에 동의하고 서비스를 이용하는 회원을 말합니다.</>,
              <><b>&ldquo;콘텐츠&rdquo;</b>란 이용자가 서비스에 게시·업로드하는 테이스팅 노트, 사진, 댓글, 커뮤니티 게시글, 카탈로그 편집 등을 말합니다.</>,
            ]}
          />
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          <List
            items={[
              "본 약관은 이용자가 회원가입 시 동의함으로써 효력이 발생합니다.",
              "서비스는 필요 시 관련 법령을 위배하지 않는 범위 내에서 본 약관을 변경할 수 있으며, 변경 시 시행일 7일 전부터 서비스 내 공지 또는 이메일로 통지합니다.",
              "이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 계정을 삭제할 수 있습니다.",
            ]}
          />
        </Section>

        <Section title="제4조 (회원가입 및 계정)">
          <List
            items={[
              "회원가입은 Google 또는 Kakao OAuth를 통해 이루어집니다.",
              "이용자는 만 19세 이상이어야 하며, 서비스는 주류 관련 콘텐츠를 다루므로 미성년자는 이용할 수 없습니다.",
              "이용자는 본인의 계정을 안전하게 관리할 책임이 있으며, 계정을 타인에게 양도·대여할 수 없습니다.",
            ]}
          />
        </Section>

        <Section title="제5조 (서비스의 제공 및 변경)">
          <List
            items={[
              "서비스는 연중무휴 24시간 제공을 원칙으로 하나, 시스템 점검·장애·불가항력 등의 사유로 일시 중단될 수 있습니다.",
              "서비스는 운영상·기술상 필요에 따라 제공하는 기능의 일부 또는 전부를 변경할 수 있으며, 중요한 변경은 사전에 공지합니다.",
              "AI 큐레이터가 제공하는 답변은 참고 정보이며, 위스키 구매·투자·건강 관련 결정의 근거로 사용해서는 안 됩니다.",
            ]}
          />
        </Section>

        <Section title="제6조 (이용자의 의무 · 금지 행위)">
          <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
          <List
            items={[
              "타인의 개인정보·계정을 무단 도용하는 행위",
              "허위 정보 등록, 스팸, 광고성 콘텐츠 반복 게시",
              "타인을 비방·모욕·차별하거나 명예를 훼손하는 콘텐츠 게시",
              "저작권·상표권 등 제3자의 권리를 침해하는 콘텐츠 업로드",
              "위스키 카탈로그를 악의적으로 훼손(허위 정보 반복 등록, 대량 삭제 등)하는 행위",
              "미성년자 음주를 조장·권유하는 콘텐츠 게시",
              "불법 유통·가격 조작·사기와 관련된 거래 정보 게시",
              "서비스의 정상 운영을 방해하는 자동화 스크립트·과도한 요청 등",
            ]}
          />
        </Section>

        <Section title="제7조 (콘텐츠의 권리 · 이용 허락)">
          <List
            items={[
              "이용자가 게시한 콘텐츠의 저작권은 이용자에게 귀속됩니다.",
              "이용자는 서비스가 콘텐츠를 서비스 제공·홍보·개선 목적으로 무상으로 사용(저장·복제·전송·표시)할 수 있는 권리를 서비스에게 부여합니다.",
              "위스키 카탈로그(bottling·distillery 정보)는 위키 스타일의 공동 편집 자산이며, 개별 편집 이력은 서비스 유지를 위해 필요한 범위에서 활용될 수 있습니다.",
              "서비스는 본 약관 또는 관련 법령을 위반한 콘텐츠를 사전 통지 없이 삭제할 수 있습니다.",
            ]}
          />
        </Section>

        <Section title="제8조 (이용 제한 및 계정 정지)">
          <List
            items={[
              "이용자가 본 약관을 위반하거나 서비스의 정상 운영을 방해한 경우, 서비스는 경고·기능 제한·계정 정지·계정 삭제 등의 조치를 취할 수 있습니다.",
              "심각한 위반의 경우 사전 통지 없이 즉시 계정을 정지할 수 있으며, 관련 콘텐츠는 삭제될 수 있습니다.",
              "이용자는 계정 정지 조치에 대해 문의처를 통해 이의를 제기할 수 있습니다.",
            ]}
          />
        </Section>

        <Section title="제9조 (서비스의 종료)">
          <List
            items={[
              "이용자는 언제든 &ldquo;내 정보&rdquo; 화면에서 계정을 삭제할 수 있으며, 삭제 시 개인정보 처리방침에 따라 관련 데이터가 처리됩니다.",
              "서비스는 부득이한 사유로 서비스를 종료해야 하는 경우, 종료일 30일 전부터 공지합니다.",
            ]}
          />
        </Section>

        <Section title="제10조 (면책)">
          <List
            items={[
              "서비스는 이용자가 게시한 콘텐츠의 정확성·완전성·신뢰성에 대해 보증하지 않습니다.",
              "서비스는 이용자 간의 거래·의사소통에서 발생한 분쟁에 개입하지 않으며, 이로 인한 손해에 대해 책임지지 않습니다.",
              "천재지변·불가항력·제3자 서비스(Supabase, Anthropic 등)의 장애로 인한 서비스 중단에 대해 책임을 지지 않습니다.",
              "AI 큐레이터의 답변은 정보 제공 목적이며, 이로 인한 결정에 대한 책임은 이용자에게 있습니다.",
            ]}
          />
        </Section>

        <Section title="제11조 (준거법 및 관할)">
          <p>본 약관은 대한민국 법률에 따라 해석되며, 서비스 이용과 관련하여 분쟁이 발생한 경우 민사소송법상의 관할 법원에서 이를 해결합니다.</p>
        </Section>

        <Section title="제12조 (문의)">
          <p>
            본 약관에 관한 문의는 <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-4">{CONTACT_EMAIL}</a> 로 연락 주시기 바랍니다.
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
