import type { WhiskyCountry, CaskType } from "@/types/database";
import { parseFlavors, type FlavorTag } from "@/lib/tastings/flavor-filters";

export const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
export const DEFAULT_PAGE_SIZE = 24;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

// Backcompat: 일부 코드가 PAGE_SIZE import 중. DEFAULT 별칭으로 유지.
export const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export const SORT_OPTIONS = [
  { value: "recent",     label: "최근 등록" },
  { value: "score",      label: "평균 점수" },
  { value: "value",      label: "가성비" },
  { value: "buy_again",  label: "다시 살래요 %" },
  { value: "tastings",   label: "테이스팅 많은 순" },
  { value: "age_desc",   label: "숙성 높은 순" },
  { value: "age_asc",    label: "숙성 낮은 순" },
  { value: "abv_desc",   label: "도수 높은 순" },
  { value: "name",       label: "이름" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export type Filters = {
  q: string;
  country: WhiskyCountry | "";
  region: string;
  cask: CaskType | "";
  age_min: number | null;
  age_max: number | null;
  abv_min: number | null;
  abv_max: number | null;
  sort: SortKey;
  page: number;
  pageSize: PageSize;
  flavors: FlavorTag[];
};

export function parseSearchParams(sp: Record<string, string | string[] | undefined>): Filters {
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : "";
  };
  const num = (k: string): number | null => {
    const s = get(k);
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const sortRaw = get("sort") as SortKey;
  const sort: SortKey = SORT_OPTIONS.some((o) => o.value === sortRaw)
    ? sortRaw
    : "recent";
  const page = Math.max(1, Number(get("page")) || 1);

  const pageSizeRaw = Number(get("size"));
  const pageSize: PageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSizeRaw)
    ? (pageSizeRaw as PageSize)
    : DEFAULT_PAGE_SIZE;

  return {
    q: get("q").trim(),
    country: (get("country") as WhiskyCountry) || "",
    region: get("region").trim(),
    cask: (get("cask") as CaskType) || "",
    age_min: num("age_min"),
    age_max: num("age_max"),
    abv_min: num("abv_min"),
    abv_max: num("abv_max"),
    sort,
    page,
    pageSize,
    flavors: parseFlavors(get("flavors")),
  };
}

export function toQueryString(
  filters: Partial<Filters>,
  base?: URLSearchParams,
): string {
  const sp = new URLSearchParams(base);
  const setOrDelete = (k: string, v: string | number | null | undefined) => {
    if (v === null || v === undefined || v === "" || v === 0) sp.delete(k);
    else sp.set(k, String(v));
  };
  if ("q" in filters)       setOrDelete("q",       filters.q);
  if ("country" in filters) setOrDelete("country", filters.country);
  if ("region" in filters)  setOrDelete("region",  filters.region);
  if ("cask" in filters)    setOrDelete("cask",    filters.cask);
  if ("age_min" in filters) setOrDelete("age_min", filters.age_min);
  if ("age_max" in filters) setOrDelete("age_max", filters.age_max);
  if ("abv_min" in filters) setOrDelete("abv_min", filters.abv_min);
  if ("abv_max" in filters) setOrDelete("abv_max", filters.abv_max);
  if ("sort" in filters && filters.sort !== "recent") setOrDelete("sort", filters.sort);
  if ("pageSize" in filters && filters.pageSize !== DEFAULT_PAGE_SIZE) {
    setOrDelete("size", filters.pageSize);
  } else if ("pageSize" in filters) {
    sp.delete("size");
  }
  if ("flavors" in filters) {
    const arr = filters.flavors ?? [];
    if (arr.length === 0) sp.delete("flavors");
    else sp.set("flavors", arr.join(","));
  }
  if ("page" in filters && (filters.page ?? 1) > 1) setOrDelete("page", filters.page);
  else sp.delete("page");

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
