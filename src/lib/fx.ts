// 환율 변환 헬퍼. 페이지에서 currency_rates 로드 후 호출.
//
// 사용:
//   const rates = await loadRates(supabase);
//   formatPriceKrw(98.57, "EUR", rates) → "₩173,232"

export type RateMap = Map<string, { krw_per_unit: number; fetched_at: string }>;

export function toKrw(amount: number, currency: string, rates: RateMap): number | null {
  const code = currency.toUpperCase();
  if (code === "KRW") return Math.round(amount);
  const rate = rates.get(code);
  if (!rate) return null;
  return Math.round(amount * rate.krw_per_unit);
}

export function formatKrw(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

// 환율 기준일 (사용자 투명성)
export function rateAsOf(currency: string, rates: RateMap): string | null {
  const r = rates.get(currency.toUpperCase());
  if (!r) return null;
  // ISO timestamp → "YYYY.MM.DD"
  return r.fetched_at.slice(0, 10).replace(/-/g, ".");
}
