-- 손큐레이션 시드 데이터.
-- `supabase db reset` 시 마이그레이션 후 자동 실행.
-- ON CONFLICT (lower(name), country) DO NOTHING — 재실행 안전.

-- ────────────────────────────────────────────────
-- distilleries
-- ────────────────────────────────────────────────
insert into public.distilleries (name, country, region, status, founded_year, description) values
  -- Scotland · Speyside
  ('Macallan',      'scotland', 'Speyside',     'active', 1824, '셰리캐스크 숙성의 대명사. 럭셔리 노선.'),
  ('Glenfiddich',   'scotland', 'Speyside',     'active', 1887, '세계에서 가장 많이 팔리는 싱글몰트.'),
  ('Glenlivet',     'scotland', 'Speyside',     'active', 1824, '스카치 위스키법(1823)의 산물. 부드러운 스피사이드 표본.'),
  ('Glenfarclas',   'scotland', 'Speyside',     'active', 1836, '셰리 직화 가족경영. 가성비 셰리캐스크.'),
  ('Aberlour',      'scotland', 'Speyside',     'active', 1826, 'A''bunadh 캐스크스트렝스로 유명.'),
  ('Balvenie',      'scotland', 'Speyside',     'active', 1892, 'Glenfiddich 자매. 더블우드 12·캐러비안캐스크 14.'),
  ('Mortlach',      'scotland', 'Speyside',     'active', 1823, '"Dufftown의 야수" — 2.81회 증류, 묵직한 미트.'),
  ('Glen Grant',    'scotland', 'Speyside',     'active', 1840, '키 큰 증류기로 라이트하고 과실향.'),
  ('GlenAllachie',  'scotland', 'Speyside',     'active', 1967, 'Billy Walker가 인수 후 단숨에 컬트.'),
  ('Glen Moray',    'scotland', 'Speyside',     'active', 1897, '가성비 와인캐스크 피니시 다양.'),
  -- Scotland · Highlands
  ('Glenmorangie',  'scotland', 'Highlands',    'active', 1843, '스코틀랜드에서 가장 키 큰 증류기.'),
  ('Dalmore',       'scotland', 'Highlands',    'active', 1839, '12사슴 로고. 셰리·포트·마데이라 피니시.'),
  ('Oban',          'scotland', 'Highlands',    'active', 1794, '바닷가 마을의 작은 증류소.'),
  ('Old Pulteney',  'scotland', 'Highlands',    'active', 1826, '본토 최북단. 짠 바닷바람.'),
  ('Glengoyne',     'scotland', 'Highlands',    'active', 1833, '논피티드 — 100% 비피트.'),
  -- Scotland · Islay
  ('Ardbeg',        'scotland', 'Islay',        'active', 1815, '강한 피트와 시트러스. 광신적 팬덤.'),
  ('Laphroaig',     'scotland', 'Islay',        'active', 1815, '소독약·요오드 향. 호불호 극명.'),
  ('Lagavulin',     'scotland', 'Islay',        'active', 1816, '진한 피트와 풍부한 셰리.'),
  ('Bowmore',       'scotland', 'Islay',        'active', 1779, 'Islay 최초 공식 증류소. 부드러운 피트+트로피컬.'),
  ('Caol Ila',      'scotland', 'Islay',        'active', 1846, '깔끔한 시가향 피트. Johnnie Walker 핵심.'),
  ('Bunnahabhain',  'scotland', 'Islay',        'active', 1881, 'Islay에서 드물게 비피트 본편 라인업.'),
  ('Bruichladdich', 'scotland', 'Islay',        'active', 1881, 'Classic Laddie 비피트, Port Charlotte/Octomore 피트.'),
  ('Kilchoman',     'scotland', 'Islay',        'active', 2005, 'Islay 신생 농장 증류소. 보리부터 직접.'),
  -- Scotland · Campbeltown
  ('Springbank',    'scotland', 'Campbeltown',  'active', 1828, '구매 제한 걸릴 정도의 컬트. 전통 플로어몰팅.'),
  -- Scotland · Islands
  ('Talisker',      'scotland', 'Islands',      'active', 1830, 'Skye의 후추+소금+피트.'),
  ('Highland Park', 'scotland', 'Islands',      'active', 1798, 'Orkney의 헤더 피트.'),
  ('Arran',         'scotland', 'Islands',      'active', 1995, 'Arran섬. 신생이지만 빠르게 자리잡음.'),
  -- Scotland · Lowlands
  ('Auchentoshan',  'scotland', 'Lowlands',     'active', 1823, '3회 증류로 가벼움.'),
  ('Glenkinchie',   'scotland', 'Lowlands',     'active', 1837, '에든버러 근처. 풀향 가벼움.'),
  -- Scotland · Closed / Silent (컬트 대상)
  ('Port Ellen',    'scotland', 'Islay',        'closed', 1825, '1983년 폐쇄. 경매 슈퍼스타. 2024년 재개.'),
  ('Brora',         'scotland', 'Highlands',    'silent', 1819, '1983년 침묵 후 2021년 재개.'),

  -- Japan
  ('Yamazaki',      'japan',    'Honshu',       'active', 1923, '일본 최초 증류소. Suntory 플래그십.'),
  ('Hakushu',       'japan',    'Honshu',       'active', 1973, '일본 알프스의 가벼운 피트.'),
  ('Yoichi',        'japan',    'Hokkaido',     'active', 1934, 'Nikka 창업자 타케츠루의 첫 증류소. 석탄 직화.'),
  ('Miyagikyo',     'japan',    'Honshu',       'active', 1969, 'Nikka의 두 번째. 부드러운 셰리.'),
  ('Chichibu',      'japan',    'Honshu',       'active', 2008, 'Ichiro''s Malt. 신생이지만 세계적 인지도.'),
  ('Mars Shinshu',  'japan',    'Honshu',       'active', 1985, '나가노 산속 — 일본에서 가장 높은 증류소.'),
  ('Akkeshi',       'japan',    'Hokkaido',     'active', 2016, '일본의 Islay 지향 — 강한 피트.'),

  -- Ireland
  ('Bushmills',     'ireland',   'Northern Ireland', 'active', 1608, '세계에서 가장 오래된 면허 증류소(공식).'),
  ('Midleton',      'ireland',   'Cork',         'active', 1825, 'Jameson, Redbreast, Green Spot 등 거대 생산처.'),
  ('Cooley',        'ireland',   'Louth',        'active', 1987, 'Connemara(피트)·Tyrconnell(싱글몰트).'),
  ('Teeling',       'ireland',   'Dublin',      'active', 2015, '125년 만에 더블린에 돌아온 증류소.'),
  ('Waterford',     'ireland',   'Waterford',   'active', 2015, 'Bruichladdich 출신. 테루아 강조.'),

  -- USA
  ('Buffalo Trace', 'usa',       'Kentucky',     'active', 1773, 'Pappy Van Winkle, BTAC 시리즈 등 컬트의 본산.'),
  ('Heaven Hill',   'usa',       'Kentucky',     'active', 1935, 'Elijah Craig, Evan Williams, Henry McKenna.'),
  ('Wild Turkey',   'usa',       'Kentucky',     'active', 1869, '101 프루프. Russell''s Reserve.'),
  ('Maker''s Mark', 'usa',       'Kentucky',     'active', 1953, '밀이 들어간 부드러운 휘티드 버번.'),
  ('Woodford Reserve','usa',     'Kentucky',     'active', 1812, '구리 팟 스틸 트리플 증류 버번.'),
  ('Four Roses',    'usa',       'Kentucky',     'active', 1888, '2 매시빌 × 5 효모 = 10 레시피.'),
  ('Jack Daniel''s','usa',       'Tennessee',    'active', 1866, '단풍나무 차콜 멜로잉(Lincoln County Process).'),
  ('George Dickel', 'usa',       'Tennessee',    'active', 1870, 'Jack Daniel''s의 라이벌. 더 깔끔.'),

  -- Taiwan / Sweden / India
  ('Kavalan',       'taiwan',    'Yilan',        'active', 2005, '아열대 숙성으로 압축된 시간. 셰리 강세.'),
  ('Omar',          'taiwan',    'Nantou',      'active', 2008, '난터우 — 와인캐스크 다양.'),
  ('Mackmyra',      'sweden',    'Gävle',       'active', 1999, '스웨덴 최초 위스키 증류소.'),
  ('Amrut',         'india',     'Bangalore',   'active', 1948, '인도 더위로 천사의 몫 12%. 빠른 숙성.'),
  ('Paul John',     'india',     'Goa',          'active', 2008, 'Goa의 인디언 싱글몰트.'),

  -- South Korea
  ('Ki One',        'south_korea','Gyeonggi',    'active', 2020, '한국 최초 본격 싱글몰트 증류소(경기 남양주).')
on conflict (lower(name), country) do nothing;

-- ────────────────────────────────────────────────
-- bottlings — 대표작들. CTE로 distillery_id 조회 후 삽입.
-- ────────────────────────────────────────────────
with d as (
  select id, lower(name) as nm, country from public.distilleries
)
insert into public.bottlings (distillery_id, name, age_years, abv, cask_type, bottler)
select id, b.name, b.age, b.abv, b.cask::cask_type, 'official'::bottler_kind
from d
join (values
  ('macallan',      'scotland', '12 Year Old Double Cask',    12,   40.0, 'sherry'),
  ('macallan',      'scotland', '18 Year Old Sherry Oak',      18,   43.0, 'sherry'),
  ('glenfiddich',   'scotland', '12 Year Old',                 12,   40.0, 'mixed'),
  ('glenfiddich',   'scotland', '15 Year Old Solera',          15,   40.0, 'mixed'),
  ('glenlivet',     'scotland', '12 Year Old',                 12,   40.0, 'mixed'),
  ('glenfarclas',   'scotland', '105 Cask Strength',           null, 60.0, 'sherry'),
  ('aberlour',      'scotland', 'A''bunadh',                   null, 60.7, 'sherry'),
  ('balvenie',      'scotland', 'DoubleWood 12',               12,   40.0, 'sherry'),
  ('glenmorangie',  'scotland', 'The Original 10',             10,   40.0, 'bourbon'),
  ('glenmorangie',  'scotland', 'Lasanta 12 Sherry Cask',      12,   43.0, 'sherry'),
  ('dalmore',       'scotland', '12 Year Old',                 12,   40.0, 'sherry'),
  ('oban',          'scotland', '14 Year Old',                 14,   43.0, 'bourbon'),
  ('ardbeg',        'scotland', '10 Year Old',                 10,   46.0, 'bourbon'),
  ('ardbeg',        'scotland', 'Uigeadail',                   null, 54.2, 'sherry'),
  ('laphroaig',     'scotland', '10 Year Old',                 10,   40.0, 'bourbon'),
  ('laphroaig',     'scotland', 'Quarter Cask',                null, 48.0, 'bourbon'),
  ('lagavulin',     'scotland', '16 Year Old',                 16,   43.0, 'sherry'),
  ('bowmore',       'scotland', '12 Year Old',                 12,   40.0, 'bourbon'),
  ('bruichladdich', 'scotland', 'Classic Laddie',              null, 50.0, 'bourbon'),
  ('bruichladdich', 'scotland', 'Port Charlotte 10',           10,   50.0, 'bourbon'),
  ('springbank',    'scotland', '10 Year Old',                 10,   46.0, 'mixed'),
  ('talisker',      'scotland', '10 Year Old',                 10,   45.8, 'bourbon'),
  ('highland park', 'scotland', '12 Year Old Viking Honour',   12,   40.0, 'sherry'),
  ('yamazaki',      'japan',    '12 Year Old',                 12,   43.0, 'mixed'),
  ('hakushu',       'japan',    '12 Year Old',                 12,   43.0, 'bourbon'),
  ('yoichi',        'japan',    'Single Malt (NAS)',           null, 45.0, 'mixed'),
  ('chichibu',      'japan',    'The Peated 2022',             null, 55.5, 'bourbon'),
  ('redbreast' /* via midleton */, 'ireland', '12 Year Old',   12,   40.0, 'sherry'),  -- 매칭 없음 → 무시됨
  ('bushmills',     'ireland',  'Black Bush',                  null, 40.0, 'sherry'),
  ('teeling',       'ireland',  'Small Batch',                 null, 46.0, 'rum'),
  ('buffalo trace', 'usa',      'Buffalo Trace',               null, 45.0, 'virgin_oak'),
  ('maker''s mark', 'usa',      'Maker''s Mark',               null, 45.0, 'virgin_oak'),
  ('wild turkey',   'usa',      '101',                         null, 50.5, 'virgin_oak'),
  ('kavalan',       'taiwan',   'Classic Single Malt',         null, 40.0, 'bourbon'),
  ('kavalan',       'taiwan',   'Solist Sherry Cask',          null, 57.8, 'sherry'),
  ('amrut',         'india',    'Fusion',                      null, 50.0, 'mixed'),
  ('ki one',        'south_korea', 'Tiger Edition',            null, 56.2, 'mixed')
) as b(dist_name, dist_country, name, age, abv, cask)
  on d.nm = b.dist_name and d.country = b.dist_country::whisky_country
-- 중복 방지 — 같은 (distillery, name) 이미 있으면 스킵
where not exists (
  select 1 from public.bottlings x
  where x.distillery_id = d.id and lower(x.name) = lower(b.name)
);
