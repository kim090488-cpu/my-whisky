-- ────────────────────────────────────────────────
-- post-photos 버킷을 public에서 private으로 전환
--   기존: 누구나 URL만 알면 사진 접근 가능 (비공개 포스트 사진도 스니핑 가능)
--   개선: 앱에서 signed URL(1시간 만료) 발급받아야 접근
-- ────────────────────────────────────────────────

update storage.buckets set public = false where id = 'post-photos';

-- SELECT RLS는 유지 (authed·anon 모두 signed URL 생성 시 통과)
-- 실질적 접근 제어는 app-layer(포스트 visibility 체크 후 URL 노출)에서.
-- upload/delete policy는 기존 그대로 유지.
