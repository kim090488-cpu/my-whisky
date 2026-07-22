-- ────────────────────────────────────────────────
-- admin 승격 헬퍼 (이메일 버전)
-- ────────────────────────────────────────────────


-- ─── 옵션) 이메일 확인이 필요하면 먼저 이거 한 줄만 Run ───
select u.email, p.username, p.is_admin
from auth.users u
join public.profiles p on p.id = u.id
order by p.created_at desc;


-- ─── 메인) 이메일 한 곳만 교체 → 통째로 Run ───

update public.profiles
set is_admin = true
where id = (
  select id from auth.users
  where lower(email) = lower('여기에_본인_이메일@example.com')
);


-- ─── 검증 ───
select u.email, p.username, p.is_admin
from public.profiles p
join auth.users u on u.id = p.id
where p.is_admin = true;
--
-- 본인 한 줄 + is_admin = true 보이면 OK.
-- → 브라우저 로그아웃 → 로그인 → 우상단 "관리" 배지 확인
--
