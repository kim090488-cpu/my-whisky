# my-whisky · mobile (Expo)

웹 my-whisky와 **같은 Supabase 백엔드** 공유. RLS·인증·Storage 모두 공통.

## 스택
- Expo SDK 54 (React Native 0.81, React 19.1)
- expo-router 6 (file-based routing, typed routes)
- @supabase/supabase-js + AsyncStorage (세션 영속)
- TypeScript 5

## 설정

```powershell
cd D:\my-whisky\mobile
npm install
copy .env.example .env.local
# .env.local 에 EXPO_PUBLIC_SUPABASE_URL/KEY 채우기 (웹 .env.local 과 동일 값)
```

## 실행

```powershell
npm start
```

→ QR 코드 나옴. **Expo Go** 앱 (App Store/Play Store) 으로 스캔하면 즉시 실행.

또는:
- `npm run android` — Android 에뮬레이터
- `npm run ios` — Mac에서만, iOS 시뮬레이터

## 폴더 구조

```
app/
  _layout.tsx              — root Stack
  (tabs)/
    _layout.tsx            — 5탭 (홈·위스키·컬렉션·피드·내정보)
    index.tsx              — 홈
    whiskies.tsx           — 카탈로그
    collection.tsx         — 컬렉션
    feed.tsx               — 피드
    me.tsx                 — 내정보
lib/
  supabase.ts              — Supabase 클라이언트 (AsyncStorage + PKCE)
  format.ts                — 웹과 공유 가능한 포맷터·라벨 (복사본)
types/
  database.ts              — 웹과 동일 타입 (복사본)
```

## 백엔드 변경 반영

웹의 Supabase 마이그레이션을 적용하면 모바일은 **자동 반영** — 코드 변경 없음.
타입이 바뀌면 `mobile/types/database.ts` 도 갱신:

```powershell
copy ..\src\types\database.ts .\types\database.ts
```

## 빌드 (배포용)

EAS Build 사용:
```powershell
npm install -g eas-cli
eas login
eas build --profile production --platform android   # AAB
eas build --profile production --platform ios       # IPA
```

`eas.json` 설정 필요 — Phase 5.5 또는 배포 직전에.
