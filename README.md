# my-whisky

위스키 커뮤니티 — 보틀링 카탈로그, 테이스팅 노트, 내 컬렉션, 마켓 시세.

## 스택
- Next.js 16.2.6 (App Router, src/, Turbopack)
- React 19.2.4
- Supabase (auth + DB + storage)
- Tailwind v4
- TypeScript 5

## 폴더 구조
```
src/
  app/
    page.tsx                     — 랜딩
    whiskies/page.tsx            — 보틀링 카탈로그 (검색)
    whiskies/[id]/page.tsx       — 보틀링 상세 + 테이스팅 + 컬렉션 추가
    distilleries/page.tsx        — 증류소 목록 (국가별 그룹)
    distilleries/[id]/page.tsx   — 증류소 상세 + 보유 보틀링
    login/, signup/              — 이메일·비밀번호 인증
    me/, me/collection/, me/tastings/  — 내 페이지 (auth gate)
  lib/
    supabase/                    — client / server / middleware
    auth/, tastings/, collection/ — server actions
    format.ts                    — 국가·캐스크 한글 라벨, 포맷터
  components/top-nav.tsx
  types/database.ts              — 수동 작성 (init_schema와 동기)
  proxy.ts                       — Next.js 16 신규 convention (middleware → proxy)
supabase/
  migrations/20260621120000_init_schema.sql
  seed.sql                       — 대표 증류소 ~52 + 보틀링 ~35
```

## 셋업 (Supabase 신규 프로젝트 만들기)

1. **신규 Supabase 프로젝트 생성** (my-michelin과 분리)
   - https://supabase.com/dashboard → New Project
   - 리전: `Northeast Asia (Seoul)` 권장
   - DB 비밀번호는 안전한 곳에 저장
   - 프로젝트 생성 후 Settings → API에서 Project URL · `anon` `public` key 복사

2. **환경 변수 설정**
   ```powershell
   copy .env.example .env.local
   # .env.local 열어서 채우기:
   #   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   #   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   #   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   ```

3. **마이그레이션 + 시드 적용** — 두 가지 방법

   **A) Supabase Dashboard SQL Editor (간단)**
   - Dashboard → SQL Editor → New query
   - `supabase/migrations/20260621120000_init_schema.sql` 내용 붙여넣기 → Run
   - 새 query에 `supabase/seed.sql` 내용 붙여넣기 → Run

   **B) Supabase CLI (재현성 좋음)**
   ```powershell
   # 처음 한 번
   npx supabase login
   npx supabase link --project-ref <your-project-ref>

   # 마이그레이션 적용
   npx supabase db push
   # 시드 실행
   npx supabase db execute --file supabase/seed.sql
   ```

4. **타입 자동생성 (선택)** — 스키마 변경 시
   ```powershell
   npx supabase gen types typescript --linked > src/types/database.ts
   ```

5. **개발 서버 실행**
   ```powershell
   npm run dev
   # http://localhost:3000
   ```

## MVP 범위 / 진행 상황
- [x] 보틀링·증류소 카탈로그 (검색·상세)
- [x] 테이스팅 노트 (점수·코·맛·피니시·총평·공개 범위)
- [x] 컬렉션 / 위시리스트
- [ ] 마켓 가격 시세 — 데이터 소스 확보 후 (`market_prices` 테이블 추가 예정)

## 다음 단계 후보
- 사용자가 새 증류소·보틀링 제안하는 폼 (위키 스타일)
- 모바일 앱 (Expo, my-michelin과 동일 구조)
- 팔로우·피드 (소셜 그래프)
- 라벨 이미지 업로드 (Supabase Storage)
- 관리자 페이지 (my-michelin admin 패턴 + inquiries 채널)

## 데이터 시드 정책
- Whiskybase 스크레이핑 X (ToS·저작권)
- 위키피디아 등 공개 정보 기반 손큐레이션이 시드 초기 ~50개
- 사용자가 새 증류소/보틀링 추가 → 위키 스타일로 성장
