// WHISKY:EDITION 외부 리뷰 카드.
//   - 데이터: bottling_external_reviews where source='whisky_edition'
//   - 라이선스: 출처 링크 노출 의무 — source_url로 처리
//   - anti-rating 정책: value_for_money 1~5 별점은 표시하지 않음. 점수(0~100)만.
//   - 가격: 원화 환산 우선 + 원통화·환율 기준일 함께 (사용자 투명성)

import { toKrw, formatKrw, rateAsOf, type RateMap } from "@/lib/fx";

type Review = {
  source_url: string | null;
  reviewer_a_name: string | null;
  reviewer_a_score: number | null;
  reviewer_b_name: string | null;
  reviewer_b_score: number | null;
  nose: string | null;
  palate: string | null;
  finish: string | null;
  conclusion_a: string | null;
  conclusion_b: string | null;
  price_per_liter: number | null;
  price_currency: string | null;
  flavour: string | null;
  image_url: string | null;
};

function avgScore(a: number | null, b: number | null): number | null {
  const vals = [a, b].filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

function formatOriginalPrice(ppl: number, currency: string): string {
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "JPY" ? "¥" : `${currency} `;
  return `${sym}${ppl.toLocaleString()}`;
}

export function WhiskyEditionCard({ review, rates }: { review: Review; rates: RateMap }) {
  const avg = avgScore(review.reviewer_a_score, review.reviewer_b_score);
  const hasNotes = !!(review.nose || review.palate || review.finish);
  const hasConclusion = !!(review.conclusion_a || review.conclusion_b);

  // 가격 환산
  let priceBlock: { krw: string; original: string; asOf: string | null } | null = null;
  if (review.price_per_liter !== null && review.price_currency) {
    const krwAmount = toKrw(review.price_per_liter, review.price_currency, rates);
    if (krwAmount !== null) {
      priceBlock = {
        krw: `${formatKrw(krwAmount)}/L`,
        original: `${formatOriginalPrice(review.price_per_liter, review.price_currency)}/L`,
        asOf: rateAsOf(review.price_currency, rates),
      };
    } else {
      // 환율 데이터 없음 — 원통화만
      priceBlock = {
        krw: `${formatOriginalPrice(review.price_per_liter, review.price_currency)}/L`,
        original: "",
        asOf: null,
      };
    }
  }

  return (
    <section className="mt-12 border-t border-neutral-900 pt-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">전문 리뷰</h2>
        {review.source_url && (
          <a
            href={review.source_url}
            target="_blank"
            rel="noopener"
            className="text-xs text-amber-300/80 hover:underline"
          >
            WHISKY:EDITION 원문 ↗
          </a>
        )}
      </div>

      <p className="mb-4 text-xs text-neutral-500">
        독일 위스키 매니아 Marcel·Sascha의 리뷰예요.
        {" "}
        <span className="text-neutral-600">출처: </span>
        <a
          href={review.source_url ?? "https://thewhiskyedition.com"}
          target="_blank"
          rel="noopener"
          className="text-amber-300/80 hover:underline"
        >
          thewhiskyedition.com
        </a>
      </p>

      <div className="rounded-lg border border-neutral-900 bg-neutral-950 p-5">
        <div className="flex items-start gap-4">
          {review.image_url && (
            <a
              href={review.source_url ?? "#"}
              target="_blank"
              rel="noopener"
              className="shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={review.image_url}
                alt=""
                className="h-24 w-24 rounded border border-neutral-800 object-cover"
              />
            </a>
          )}

          <div className="min-w-0 flex-1">
            {/* 점수 (2명 평균 강조 + 개별 표시) */}
            <div className="flex items-baseline gap-3">
              {avg !== null && (
                <>
                  <span className="text-3xl font-semibold text-amber-300">{avg}</span>
                  <span className="text-xs text-neutral-500">/ 100</span>
                </>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
              {review.reviewer_a_score !== null && (
                <span>
                  {review.reviewer_a_name ?? "리뷰어 A"}{" "}
                  <span className="text-neutral-200">{review.reviewer_a_score}</span>
                </span>
              )}
              {review.reviewer_b_score !== null && (
                <span>
                  {review.reviewer_b_name ?? "리뷰어 B"}{" "}
                  <span className="text-neutral-200">{review.reviewer_b_score}</span>
                </span>
              )}
            </div>

            {/* 가격·풍미 */}
            {(priceBlock || review.flavour) && (
              <div className="mt-3 space-y-1 text-xs">
                {priceBlock && (
                  <div className="text-neutral-300">
                    <span className="text-neutral-500">참고가 · </span>
                    <span className="text-neutral-100">{priceBlock.krw}</span>
                    {priceBlock.original && (
                      <span className="text-neutral-500">
                        {" "}≈ {priceBlock.original}
                        {priceBlock.asOf && ` · 환율 ${priceBlock.asOf}`}
                      </span>
                    )}
                  </div>
                )}
                {review.flavour && (
                  <div className="text-neutral-300">
                    <span className="text-neutral-500">풍미 · </span>
                    {review.flavour}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 테이스팅 노트 */}
        {hasNotes && (
          <dl className="mt-5 space-y-2 border-t border-neutral-900 pt-4 text-sm text-neutral-300">
            {review.nose && (
              <div>
                <dt className="inline text-neutral-500">코 · </dt>
                <dd className="inline">{review.nose}</dd>
              </div>
            )}
            {review.palate && (
              <div>
                <dt className="inline text-neutral-500">맛 · </dt>
                <dd className="inline">{review.palate}</dd>
              </div>
            )}
            {review.finish && (
              <div>
                <dt className="inline text-neutral-500">피니시 · </dt>
                <dd className="inline">{review.finish}</dd>
              </div>
            )}
          </dl>
        )}

        {/* 결론 */}
        {hasConclusion && (
          <div className="mt-4 space-y-3 border-t border-neutral-900 pt-4 text-sm text-neutral-200">
            {review.conclusion_a && (
              <p>
                <span className="text-xs text-neutral-500">{review.reviewer_a_name ?? "A"} · </span>
                {review.conclusion_a}
              </p>
            )}
            {review.conclusion_b && (
              <p>
                <span className="text-xs text-neutral-500">{review.reviewer_b_name ?? "B"} · </span>
                {review.conclusion_b}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
