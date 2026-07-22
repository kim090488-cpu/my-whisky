import type { WhiskyCountry, CaskType, CollectionStatus, BottlerKind, PriceSource } from "@/types/database";

export const PRICE_SOURCE_LABEL: Record<PriceSource, string> = {
  retail: "리테일",
  auction: "경매",
  secondhand: "중고",
  duty_free: "면세점",
};

export function formatPrice(amount: number, currency: string = "KRW"): string {
  if (currency === "KRW") return `${Math.round(amount).toLocaleString()}원`;
  if (currency === "USD") return `$${amount.toLocaleString()}`;
  return `${amount.toLocaleString()} ${currency}`;
}

export const COUNTRY_LABEL: Record<WhiskyCountry, string> = {
  scotland: "스코틀랜드",
  ireland: "아일랜드",
  usa: "미국",
  canada: "캐나다",
  japan: "일본",
  india: "인도",
  taiwan: "대만",
  australia: "호주",
  france: "프랑스",
  sweden: "스웨덴",
  germany: "독일",
  south_korea: "한국",
  other: "기타",
};

export const COUNTRY_FLAG: Record<WhiskyCountry, string> = {
  scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  ireland: "🇮🇪",
  usa: "🇺🇸",
  canada: "🇨🇦",
  japan: "🇯🇵",
  india: "🇮🇳",
  taiwan: "🇹🇼",
  australia: "🇦🇺",
  france: "🇫🇷",
  sweden: "🇸🇪",
  germany: "🇩🇪",
  south_korea: "🇰🇷",
  other: "🏳️",
};

export const CASK_LABEL: Record<CaskType, string> = {
  bourbon: "버번",
  sherry: "셰리",
  port: "포트",
  wine: "와인",
  rum: "럼",
  virgin_oak: "버진오크",
  refill: "리필",
  mixed: "믹스",
  other: "기타",
  unknown: "—",
};

export const BOTTLER_LABEL: Record<BottlerKind, string> = {
  official: "공식(OB)",
  independent: "독립병입(IB)",
  private: "프라이빗",
};

export const COLLECTION_LABEL: Record<CollectionStatus, string> = {
  owned: "소장",
  opened: "오픈됨",
  finished: "비움",
  wishlist: "위시리스트",
};

export function formatAge(age: number | null): string {
  return age === null ? "NAS" : `${age}년`;
}

export function formatAbv(abv: number | null): string {
  return abv === null ? "—" : `${abv}%`;
}

export function formatScore(score: number | null): string {
  return score === null ? "—" : `${score}점`;
}
