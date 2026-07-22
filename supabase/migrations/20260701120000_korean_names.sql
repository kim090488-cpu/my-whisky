-- ────────────────────────────────────────────────────────────────────
-- 한글 표기 추가: distilleries.name_kr, bottlings.name_kr
-- ────────────────────────────────────────────────────────────────────
-- 사용자가 영문 위주 데이터를 읽기 어려워해서 한글 병기 필드 추가.
-- name_kr이 있으면 카드/상세에서 한글 우선 + 영문 보조 표시.
-- ────────────────────────────────────────────────────────────────────

alter table public.distilleries
  add column if not exists name_kr text check (name_kr is null or length(name_kr) <= 100);

alter table public.bottlings
  add column if not exists name_kr text check (name_kr is null or length(name_kr) <= 200);

-- bottling_card_stats view 재생성 — name_kr, distillery_name_kr 노출
drop view if exists public.trending_tastings;
drop view if exists public.bottling_card_stats;

create or replace view public.bottling_card_stats
with (security_invoker = true)
as
select
  b.id,
  b.distillery_id,
  b.name,
  b.name_kr,
  b.age_years,
  b.abv,
  b.cask_type,
  b.bottler,
  coalesce(
    b.label_image_url,
    (
      select storage_path from public.bottling_images bi
      where bi.bottling_id = b.id
      order by bi.sort_order, bi.created_at
      limit 1
    )
  ) as label_image_url,
  b.created_at,
  d.name      as distillery_name,
  d.name_kr   as distillery_name_kr,
  d.country   as country,
  d.region    as region,
  d.status    as distillery_status,
  (
    select round(avg(t.score)::numeric, 1)
    from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public' and t.score is not null
  ) as avg_score,
  (
    select count(*)::int
    from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public'
  ) as tasting_count,
  (
    select round(avg(t.value_for_money)::numeric, 2)
    from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public' and t.value_for_money is not null
  ) as avg_value_for_money,
  (
    select
      case
        when count(*) filter (where t.would_buy_again is not null) = 0 then null
        else round(
          100.0 * count(*) filter (where t.would_buy_again = true)
          / nullif(count(*) filter (where t.would_buy_again is not null), 0)
        )::int
      end
    from public.tastings t
    where t.bottling_id = b.id and t.visibility = 'public'
  ) as buy_again_pct
from public.bottlings b
left join public.distilleries d on d.id = b.distillery_id;

create or replace view public.trending_tastings
with (security_invoker = true)
as
select
  t.id, t.bottling_id, t.user_id, t.score, t.tasted_at,
  t.like_count, t.comment_count, t.notes, t.visibility,
  coalesce((
    select count(*)::int
    from public.tasting_likes l
    where l.tasting_id = t.id
      and l.created_at > now() - interval '7 days'
  ), 0) as recent_likes
from public.tastings t
where t.visibility = 'public';

-- 유명 증류소 한글명 seed (이름 일치하는 행에 한 번에 적용)
-- 이미 name_kr이 있으면 덮어쓰지 않음 (사용자 입력 보호)
update public.distilleries set name_kr = '글렌피딕'        where name = 'Glenfiddich'              and name_kr is null;
update public.distilleries set name_kr = '맥캘란'          where name = 'Macallan'                 and name_kr is null;
update public.distilleries set name_kr = '맥캘란'          where name = 'The Macallan'             and name_kr is null;
update public.distilleries set name_kr = '글렌리벳'        where name = 'Glenlivet'                and name_kr is null;
update public.distilleries set name_kr = '글렌리벳'        where name = 'The Glenlivet'            and name_kr is null;
update public.distilleries set name_kr = '글렌모렌지'      where name = 'Glenmorangie'             and name_kr is null;
update public.distilleries set name_kr = '글렌드로낙'      where name = 'GlenDronach'              and name_kr is null;
update public.distilleries set name_kr = '글렌드로낙'      where name = 'Glendronach'              and name_kr is null;
update public.distilleries set name_kr = '글렌파클라스'    where name = 'Glenfarclas'              and name_kr is null;
update public.distilleries set name_kr = '발베니'          where name = 'Balvenie'                 and name_kr is null;
update public.distilleries set name_kr = '발베니'          where name = 'The Balvenie'             and name_kr is null;
update public.distilleries set name_kr = '하이랜드 파크'   where name = 'Highland Park'            and name_kr is null;
update public.distilleries set name_kr = '라프로익'        where name = 'Laphroaig'                and name_kr is null;
update public.distilleries set name_kr = '아드벡'          where name = 'Ardbeg'                   and name_kr is null;
update public.distilleries set name_kr = '라가불린'        where name = 'Lagavulin'                and name_kr is null;
update public.distilleries set name_kr = '카발란'          where name = 'Kavalan'                  and name_kr is null;
update public.distilleries set name_kr = '야마자키'        where name = 'Yamazaki'                 and name_kr is null;
update public.distilleries set name_kr = '하쿠슈'          where name = 'Hakushu'                  and name_kr is null;
update public.distilleries set name_kr = '히비키'          where name = 'Hibiki'                   and name_kr is null;
update public.distilleries set name_kr = '치치부'          where name = 'Chichibu'                 and name_kr is null;
update public.distilleries set name_kr = '마르스'          where name = 'Mars'                     and name_kr is null;
update public.distilleries set name_kr = '폴 존'           where name = 'Paul John'                and name_kr is null;
update public.distilleries set name_kr = '암룻'            where name = 'Amrut'                    and name_kr is null;
update public.distilleries set name_kr = '님버'            where name = 'Bimber'                   and name_kr is null;
update public.distilleries set name_kr = '아베라긴'        where name = 'aberlour'                 and name_kr is null;
update public.distilleries set name_kr = '아벨라워'        where name = 'Aberlour'                 and name_kr is null;
update public.distilleries set name_kr = '부쉬밀스'        where name = 'Bushmills'                and name_kr is null;
update public.distilleries set name_kr = '제임슨'          where name = 'Jameson'                  and name_kr is null;
update public.distilleries set name_kr = '레드브레스트'    where name = 'Redbreast'                and name_kr is null;
update public.distilleries set name_kr = '미들턴'          where name = 'Midleton'                 and name_kr is null;
update public.distilleries set name_kr = '버펄로 트레이스' where name = 'Buffalo Trace'            and name_kr is null;
update public.distilleries set name_kr = '메이커스 마크'   where name = 'Maker''s Mark'            and name_kr is null;
update public.distilleries set name_kr = '우드포드 리저브' where name = 'Woodford Reserve'         and name_kr is null;
update public.distilleries set name_kr = '와일드 터키'     where name = 'Wild Turkey'              and name_kr is null;
update public.distilleries set name_kr = '잭 다니엘스'     where name = 'Jack Daniel''s'           and name_kr is null;
update public.distilleries set name_kr = '탈리스커'        where name = 'Talisker'                 and name_kr is null;
update public.distilleries set name_kr = '오반'            where name = 'Oban'                     and name_kr is null;
update public.distilleries set name_kr = '달위니'          where name = 'Dalwhinnie'               and name_kr is null;
update public.distilleries set name_kr = '클라이넬리시'    where name = 'Clynelish'                and name_kr is null;
update public.distilleries set name_kr = '카듀'            where name = 'Cardhu'                   and name_kr is null;
update public.distilleries set name_kr = '크라간모어'      where name = 'Cragganmore'              and name_kr is null;
update public.distilleries set name_kr = '딘스턴'          where name = 'Deanston'                 and name_kr is null;
update public.distilleries set name_kr = '부나하벤'        where name = 'Bunnahabhain'             and name_kr is null;
update public.distilleries set name_kr = '부나하벤'        where name = 'Bunnahabhain Distillery'  and name_kr is null;
update public.distilleries set name_kr = '바우모어'        where name = 'Bowmore'                  and name_kr is null;
update public.distilleries set name_kr = '브룩라디'        where name = 'Bruichladdich'            and name_kr is null;
update public.distilleries set name_kr = '카올 일라'       where name = 'Caol Ila'                 and name_kr is null;
update public.distilleries set name_kr = '킬호만'          where name = 'Kilchoman'                and name_kr is null;
update public.distilleries set name_kr = '스프링뱅크'      where name = 'Springbank'               and name_kr is null;
update public.distilleries set name_kr = '글렌고인'        where name = 'Glengoyne'                and name_kr is null;
update public.distilleries set name_kr = '엘스번'          where name = 'Elsburn'                  and name_kr is null;
update public.distilleries set name_kr = '엘스번'          where name = 'Elsburn The'              and name_kr is null;
update public.distilleries set name_kr = '헤르키니안'      where name = 'Hercynian Distilling'     and name_kr is null;
