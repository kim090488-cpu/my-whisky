# Play Store 출시 체크리스트

## 🚨 반드시 지금 해야 할 것

### 1. Keystore 백업 (필수 · 최우선)
Play Store에 첫 AAB를 업로드하면 keystore가 **영구 잠김**. EAS가 관리하는 keystore를 잃으면 앱 업데이트가 불가능해집니다.

```powershell
# 별도 PowerShell TTY에서:
cd D:\my-whisky\mobile
eas credentials -p android
# 프롬프트 진행:
#   → 프로필 선택: production
#   → Keystore: Download
#   → 파일이 mobile/ 에 keystore-<timestamp>.jks 로 저장됨
```

**저장 위치 권장**:
- USB 드라이브 (물리 백업)
- 개인 클라우드 (1Password, Bitwarden secure notes 첨부)
- 이메일 자기 자신에게 (제목: my-whisky android keystore, 첨부)

**함께 저장할 정보** (EAS Dashboard → Credentials에서 확인):
- Key Alias: `dc62d997f37c9b7c792d1da1827db52d`
- SHA1: `66:46:E3:80:9E:2C:E9:47:04:0B:4F:8A:07:1D:C2:FC:A1:6C:45:5B`
- Keystore password / Key password (Dashboard에서 확인)

### 2. Play Console 사전 설정

Play Console (https://play.google.com/console) 로그인 후:

1. **앱 만들기** — 앱 이름 "my-whisky", 언어 "한국어", 앱/게임 → **앱**, 무료/유료 → **무료**
2. **필수 정책 동의** — 콘텐츠 가이드라인, 개발자 프로그램 정책, 미국 수출법
3. **개발자 프로필 확인** — 이름·이메일 공개 여부 검토

## 📋 심사 제출 전 콘텐츠 준비

`play-store-listing.md` 문서 참조하여 아래 순서로 입력:

1. ⬜ **앱 세부정보** — 앱 이름·짧은 설명·자세한 설명 (listing 문서 §1)
2. ⬜ **그래픽** — 아이콘·피처 그래픽·스크린샷 최소 2장 (§11)
3. ⬜ **카테고리** — 라이프스타일
4. ⬜ **연락처 정보** — 이메일·웹사이트·개인정보처리방침 URL
5. ⬜ **개인정보처리방침 URL** — https://mywhisky-kr.vercel.app/privacy

6. ⬜ **앱 콘텐츠 > 앱 액세스** — "일부 기능 제한" + 심사팀 로그인 정보
7. ⬜ **앱 콘텐츠 > 광고** — 광고 없음
8. ⬜ **앱 콘텐츠 > 콘텐츠 등급** — IARC 설문 (§3)
9. ⬜ **앱 콘텐츠 > 대상 연령** — 18세 이상
10. ⬜ **앱 콘텐츠 > 뉴스 앱** — 아님
11. ⬜ **앱 콘텐츠 > COVID-19 접촉 추적** — 아님
12. ⬜ **앱 콘텐츠 > 정부 앱** — 아님
13. ⬜ **앱 콘텐츠 > 재무 기능** — 없음
14. ⬜ **앱 콘텐츠 > 데이터 보안** — Data Safety 양식 (§2)

15. ⬜ **국가 및 지역** — 대한민국

16. ⬜ **테스트 계정 만들기** — 심사팀이 로그인할 수 있도록 test-review-1@mywhisky.test 같은 계정 생성 후 Play Console "앱 액세스" 폼에 자격증명 입력

## 🎬 AAB 업로드 & 릴리즈

### 내부 테스트 (Internal testing) 트랙 — 첫 배포 권장
1. Play Console → 테스트 → 내부 테스트 → 새 버전 만들기
2. AAB 업로드 (EAS Dashboard → Builds → Download)
3. 릴리즈 노트 작성 (예: "1.0.0 최초 릴리즈")
4. 검토 → 롤아웃
5. 테스터 이메일 추가 (본인 Gmail)
6. 내부 테스트 링크로 폰에 설치 → 검증

### 프로덕션 승격
1. 내부 테스트에서 이상 없으면 → 프로덕션 트랙 → 내부 테스트에서 복사
2. 검토 → 롤아웃 → **심사 대기 (1~7일)**
3. 승인되면 Play Store 공개

## ⚠️ 주요 반려 사유 (예방 목록)

- **미성년자 접근 미차단** → 대상 연령 18세 이상 설정 필수
- **음주 조장 콘텐츠** → 앱 설명에 "지나친 음주는 건강을 해칠 수 있습니다" 문구 포함 (listing 초안에 이미 있음)
- **심사팀 로그인 불가** → OAuth-only 앱은 test 계정 자격증명 반드시 제공
- **개인정보 처리방침 URL 접근 불가** → 공개 URL이어야 함 (확인 완료 ✅)
- **Data Safety 부정확** → 실제 수집 데이터와 신고 내용 일치해야 함
- **콘텐츠 등급 낮음** → 알코올 콘텐츠는 반드시 성인 등급으로 자진 신고
