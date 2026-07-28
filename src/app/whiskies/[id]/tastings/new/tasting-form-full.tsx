"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import { createTasting, updateTasting, deleteTasting } from "@/lib/tastings/actions";
import { TastingPhotoPicker } from "@/components/upload/tasting-photo-picker";
import { TagInput } from "@/components/tag-input";
import type { TastingVisibility, RecommendedForKind } from "@/types/database";

export type FormState = {
  // 필수 5축
  score: string;                       // 0-100
  notes: string;
  would_buy_again: "" | "true" | "false";
  value_for_money: string;             // 1-5
  recommended_for: RecommendedForKind[];

  // 메타
  tasted_at: string;                   // YYYY-MM-DD
  color: string;
  visibility: TastingVisibility;
  photos: string[];

  // 옵션 — flavor wheel 1-10
  sweetness: string;
  smokiness: string;
  fruitiness: string;
  spiciness: string;
  smoothness: string;
  complexity: string;
  finish_length: string;

  // 옵션 — 구매 메타
  purchase_price: string;
  purchase_currency: string;           // 'KRW' 'USD' ...
  purchase_country: string;
  purchased_at_place: string;
  food_pairing: string;

  // 보유 인증
  bottle_owned_verified: boolean;

  // 자유 태그 (예: #피트 #입문)
  tags: string[];
};

const todayLocal = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const blankState = (): FormState => ({
  score: "",
  notes: "",
  would_buy_again: "",
  value_for_money: "",
  recommended_for: [],
  tasted_at: todayLocal(),
  color: "",
  visibility: "public",
  photos: [],
  sweetness: "",
  smokiness: "",
  fruitiness: "",
  spiciness: "",
  smoothness: "",
  complexity: "",
  finish_length: "",
  purchase_price: "",
  purchase_currency: "KRW",
  purchase_country: "",
  purchased_at_place: "",
  food_pairing: "",
  bottle_owned_verified: false,
  tags: [],
});

const DRAFT_INTERVAL_MS = 5_000;

type EditMode = { tastingId: string; initial: Partial<FormState> };

export function TastingFormFull({
  bottlingId,
  userId,
  edit,
}: {
  bottlingId: string;
  userId: string;
  edit?: EditMode;
}) {
  const router = useRouter();
  const isEdit = !!edit;
  const [state, setState] = useState<FormState>(() =>
    edit ? { ...blankState(), ...edit.initial } : blankState(),
  );
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const draftKey = `tasting-draft-v2:${bottlingId}`;
  const mountedRef = useRef(false);

  // draft load (create 모드에서만 — edit은 이미 저장된 노트라 draft 무시)
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (isEdit) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<FormState>;
      const hasContent =
        parsed.score || parsed.notes || parsed.would_buy_again ||
        parsed.value_for_money || (parsed.recommended_for && parsed.recommended_for.length > 0) ||
        parsed.color || (parsed.photos && parsed.photos.length > 0);
      if (hasContent) {
        setState((prev) => ({ ...prev, ...parsed }));
        setDraftRestored(true);
      }
    } catch {
      // ignore
    }
  }, [draftKey, isEdit]);

  // draft autosave (create 모드만)
  useEffect(() => {
    if (isEdit) return;
    const t = setInterval(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(state));
      } catch {
        // ignore
      }
    }, DRAFT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [state, draftKey, isEdit]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const toggleRecommendedFor = (kind: RecommendedForKind) => {
    setState((s) => {
      const has = s.recommended_for.includes(kind);
      return {
        ...s,
        recommended_for: has
          ? s.recommended_for.filter((k) => k !== kind)
          : [...s.recommended_for, kind],
      };
    });
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    setState(blankState());
    setDraftRestored(false);
  };

  const requiredFilled =
    Number(!!state.score) +
    Number(!!state.notes.trim()) +
    Number(!!state.would_buy_again) +
    Number(!!state.value_for_money);
  const requiredTotal = 4;
  const requiredDone = requiredFilled === requiredTotal;
  const metaFilled =
    Number(!!state.color) +
    Number(state.photos.length > 0) +
    Number(state.bottle_owned_verified);
  const metaTotal = 3;
  const optionalFlavorFilled =
    Number(!!state.sweetness) +
    Number(!!state.smokiness) +
    Number(!!state.fruitiness) +
    Number(!!state.spiciness) +
    Number(!!state.smoothness) +
    Number(!!state.complexity) +
    Number(!!state.finish_length);
  const optionalPurchaseFilled =
    Number(!!state.purchase_price) +
    Number(!!state.purchase_country) +
    Number(!!state.purchased_at_place) +
    Number(!!state.food_pairing);
  const optionalFilled = optionalFlavorFilled + optionalPurchaseFilled;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // 클라이언트 필수 체크 (서버에서도 다시 체크되지만 빠른 피드백)
    if (!state.score) return setError("종합 점수를 입력해주세요.");
    if (!state.notes.trim()) return setError("한 줄이라도 후기를 적어주세요.");
    if (!state.would_buy_again) return setError("다시 살지 여부를 선택해주세요.");
    if (!state.value_for_money) return setError("가성비를 선택해주세요.");

    const fd = new FormData();
    fd.set("bottling_id", bottlingId);

    // 필수 5축
    fd.set("score", state.score);
    fd.set("notes", state.notes);
    fd.set("would_buy_again", state.would_buy_again);
    fd.set("value_for_money", state.value_for_money);
    for (const r of state.recommended_for) fd.append("recommended_for", r);

    // 메타
    fd.set("tasted_at", state.tasted_at);
    fd.set("color", state.color);
    fd.set("visibility", state.visibility);
    fd.set("photos", JSON.stringify(state.photos));

    // 옵션 flavor wheel
    for (const k of [
      "sweetness", "smokiness", "fruitiness", "spiciness",
      "smoothness", "complexity", "finish_length",
    ] as const) {
      if (state[k]) fd.set(k, state[k]);
    }

    // 옵션 구매 메타
    if (state.purchase_price) fd.set("purchase_price", state.purchase_price);
    if (state.purchase_currency) fd.set("purchase_currency", state.purchase_currency);
    if (state.purchase_country) fd.set("purchase_country", state.purchase_country);
    if (state.purchased_at_place) fd.set("purchased_at_place", state.purchased_at_place);
    if (state.food_pairing) fd.set("food_pairing", state.food_pairing);
    fd.set("bottle_owned_verified", state.bottle_owned_verified ? "true" : "false");
    fd.set("tags", JSON.stringify(state.tags));

    startTransition(async () => {
      const res = isEdit
        ? await updateTasting(edit!.tastingId, fd)
        : await createTasting(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (!isEdit) localStorage.removeItem(draftKey);
      router.push(isEdit ? `/tastings/${edit!.tastingId}` : `/whiskies/${bottlingId}`);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!isEdit) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteTasting(edit!.tastingId);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push(`/whiskies/${bottlingId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {draftRestored ? (
        <div className="flex items-center justify-between rounded-md border border-amber-700/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          <span>저장됐던 작성 중인 노트를 불러왔어요.</span>
          <button
            type="button"
            onClick={discardDraft}
            className="rounded px-2 py-0.5 text-amber-300 hover:bg-amber-400/20"
          >
            새로 작성
          </button>
        </div>
      ) : !isEdit ? (
        <div className="rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
          <span aria-hidden className="mr-1.5">✎</span>
          작성 중인 내용은 5초마다 자동 저장돼요. 실수로 창을 닫아도 다시 이어서 쓸 수 있어요.
        </div>
      ) : null}

      <StepIndicator
        steps={[
          {
            id: "step-required",
            label: "살까 말까",
            filled: requiredFilled,
            total: requiredTotal,
            done: requiredDone,
            required: true,
          },
          {
            id: "step-meta",
            label: "세부",
            filled: metaFilled,
            total: metaTotal,
            done: false,
            required: false,
          },
          {
            id: "step-advanced",
            label: "더 자세히",
            filled: optionalFilled,
            total: 0,
            done: false,
            required: false,
            hint: optionalFilled > 0 ? `${optionalFilled}개 채움` : "옵션",
          },
        ]}
      />

      {/* ════ 필수 5축 ════════════════════════════════════════════════════ */}
      <section
        id="step-required"
        className="space-y-6 scroll-mt-4 rounded-xl border border-border bg-card/40 p-6"
      >
        <SectionHeader title="이 위스키, 살까 말까?" subtitle="다른 사람들의 결정에 도움이 됩니다" />

        {/* 1. 종합 점수 */}
        <Field label="종합 점수" required>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={100}
              value={state.score}
              onChange={(e) => set("score", e.target.value)}
              placeholder="0–100"
              className="w-28 rounded-md border border-border bg-background px-3 py-2 text-lg font-medium focus:border-amber-400 focus:outline-none"
            />
            <span className="text-xs text-muted-foreground">예: 80 = 좋음, 90+ = 매우 좋음</span>
          </div>
        </Field>

        {/* 2. 후기 */}
        <Field label="후기" required hint="향·맛·여운·총평 자유롭게">
          <textarea
            rows={6}
            value={state.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="첫 향, 입에 머금었을 때, 삼킨 후 여운, 누구에게 추천하고 싶은지…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:border-amber-400 focus:outline-none"
          />
        </Field>

        {/* 3. 다시 살래요? */}
        <Field label="다시 살래요?" required>
          <div className="flex gap-2">
            <SegBtn
              active={state.would_buy_again === "true"}
              onClick={() => set("would_buy_again", "true")}
            >
              네, 또 살래요
            </SegBtn>
            <SegBtn
              active={state.would_buy_again === "false"}
              onClick={() => set("would_buy_again", "false")}
            >
              아니요
            </SegBtn>
          </div>
        </Field>

        {/* 4. 가성비 1-5 */}
        <Field label="가성비" required hint="가격 대비 만족도">
          <div className="flex flex-wrap gap-2">
            {(
              [
                [1, "별로"],
                [2, "그저"],
                [3, "적정"],
                [4, "좋음"],
                [5, "최고"],
              ] as const
            ).map(([n, label]) => {
              const active = state.value_for_money === String(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("value_for_money", String(n))}
                  className={[
                    "flex min-w-[68px] flex-col items-center rounded-md border px-3 py-2 text-sm transition",
                    active
                      ? "border-amber-400 bg-amber-400/10 text-amber-300"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  ].join(" ")}
                >
                  <span className="text-base font-medium tabular-nums">{n}</span>
                  <span
                    className={
                      "text-[10px] " +
                      (active ? "text-amber-300/80" : "text-muted-foreground/70")
                    }
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        {/* 5. 누구에게 추천 (선택) */}
        <Field label="누구에게 추천하시나요" hint="중복 선택 · 모르겠으면 비워두세요">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["beginner",     "초보자"],
                ["intermediate", "중급"],
                ["expert",       "전문가"],
                ["gift",         "선물용"],
              ] as const
            ).map(([kind, label]) => (
              <ChipBtn
                key={kind}
                active={state.recommended_for.includes(kind)}
                onClick={() => toggleRecommendedFor(kind)}
              >
                {label}
              </ChipBtn>
            ))}
          </div>
        </Field>
      </section>

      {/* ════ 메타 ═══════════════════════════════════════════════════════ */}
      <section id="step-meta" className="scroll-mt-4 space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="테이스팅 날짜">
          <input
            type="date"
            value={state.tasted_at}
            onChange={(e) => set("tasted_at", e.target.value)}
            className={fieldCls}
          />
        </Field>
        <Field label="색상" hint="기본 색감 또는 자유 입력">
          <input
            type="text"
            list="whisky-colors"
            value={state.color}
            onChange={(e) => set("color", e.target.value)}
            placeholder="옅은 황금"
            className={fieldCls}
          />
          <datalist id="whisky-colors">
            <option value="옅은 황금" />
            <option value="황금" />
            <option value="짙은 황금" />
            <option value="호박" />
            <option value="짙은 호박" />
            <option value="구릿빛" />
            <option value="마호가니" />
            <option value="짙은 적갈색" />
          </datalist>
        </Field>
        <Field label="공개 범위">
          <select
            value={state.visibility}
            onChange={(e) => set("visibility", e.target.value as TastingVisibility)}
            className={fieldCls}
          >
            <option value="public">공개</option>
            <option value="followers">팔로워만</option>
            <option value="private">비공개</option>
          </select>
        </Field>
      </div>

      {/* 사진 */}
      <Field label="사진" hint="최대 3장, 15MB 이하">
        <TastingPhotoPicker
          userId={userId}
          paths={state.photos}
          onChange={(paths) => set("photos", paths)}
        />
      </Field>

      {/* 자유 태그 */}
      <Field label="태그" hint="자유롭게 · 예: #피트, #입문, #선물용 · 최대 10개">
        <TagInput value={state.tags} onChange={(next) => set("tags", next)} />
      </Field>

      {/* 보유 인증 */}
      <label className="flex items-center gap-2.5 rounded-md border border-border bg-card/40 px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={state.bottle_owned_verified}
          onChange={(e) => set("bottle_owned_verified", e.target.checked)}
          className="size-4 accent-amber-400"
        />
        <span className="text-foreground">이 보틀을 직접 보유하고 있어요</span>
        <span className="text-[10px] text-muted-foreground/70">— 다른 사용자에게 신뢰 신호로 표시돼요</span>
      </label>
      </section>

      {/* ════ 더 자세히 (옵션) ══════════════════════════════════════════ */}
      <section id="step-advanced" className="scroll-mt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border border-border px-4 py-3 text-sm font-medium hover:border-foreground/30"
        >
          <span>더 자세히 (옵션) — flavor wheel · 구매 정보 · 페어링</span>
          <ChevronDown className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-6 rounded-xl border border-border bg-card/40 p-6">
            {/* Flavor wheel */}
            <div>
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Flavor wheel · 1~10
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <Slider10 label="단맛" value={state.sweetness}
                  onChange={(v) => set("sweetness", v)} />
                <Slider10 label="스모키" value={state.smokiness}
                  onChange={(v) => set("smokiness", v)} />
                <Slider10 label="과일맛" value={state.fruitiness}
                  onChange={(v) => set("fruitiness", v)} />
                <Slider10 label="스파이시" value={state.spiciness}
                  onChange={(v) => set("spiciness", v)} />
                <Slider10 label="부드러움" value={state.smoothness}
                  onChange={(v) => set("smoothness", v)} />
                <Slider10 label="복잡도" value={state.complexity}
                  onChange={(v) => set("complexity", v)} />
                <Slider10 label="여운 길이" value={state.finish_length}
                  onChange={(v) => set("finish_length", v)} />
              </div>
            </div>

            {/* 구매 정보 */}
            <div>
              <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                구매 정보
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="구매가">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={state.purchase_price}
                    onChange={(e) => set("purchase_price", e.target.value)}
                    placeholder="280000"
                    className={fieldCls}
                  />
                </Field>
                <Field label="통화">
                  <select
                    value={state.purchase_currency}
                    onChange={(e) => set("purchase_currency", e.target.value)}
                    className={fieldCls}
                  >
                    <option value="KRW">KRW</option>
                    <option value="USD">USD</option>
                    <option value="JPY">JPY</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CHF">CHF</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                    <option value="HKD">HKD</option>
                    <option value="SGD">SGD</option>
                    <option value="CNY">CNY</option>
                    <option value="TWD">TWD</option>
                  </select>
                </Field>
                <Field label="구매 국가">
                  <input
                    type="text"
                    list="purchase-countries"
                    value={state.purchase_country}
                    onChange={(e) => set("purchase_country", e.target.value)}
                    placeholder="한국"
                    className={fieldCls}
                  />
                  <datalist id="purchase-countries">
                    <option value="한국" />
                    <option value="일본" />
                    <option value="미국" />
                    <option value="영국" />
                    <option value="독일" />
                    <option value="프랑스" />
                    <option value="홍콩" />
                    <option value="싱가포르" />
                    <option value="대만" />
                    <option value="호주" />
                    <option value="캐나다" />
                    <option value="스위스" />
                  </datalist>
                </Field>
                <Field label="구매처">
                  <input
                    type="text"
                    value={state.purchased_at_place}
                    onChange={(e) => set("purchased_at_place", e.target.value)}
                    placeholder="롯데마트, 바틀샵 …"
                    className={fieldCls}
                  />
                </Field>
              </div>
            </div>

            {/* 페어링 */}
            <Field label="잘 어울리는 음식" hint="여러 개면 쉼표로 — 예: 다크초콜릿, 치즈케이크">
              <input
                type="text"
                list="food-pairings"
                value={state.food_pairing}
                onChange={(e) => set("food_pairing", e.target.value)}
                placeholder="다크초콜릿, 견과류"
                className={fieldCls}
              />
              <datalist id="food-pairings">
                <option value="다크초콜릿" />
                <option value="견과류" />
                <option value="치즈" />
                <option value="치즈케이크" />
                <option value="시가" />
                <option value="훈제연어" />
                <option value="스테이크" />
                <option value="과일" />
              </datalist>
            </Field>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-md border border-rose-700/40 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-400 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "저장 중…" : isEdit ? "수정 저장" : "노트 저장"}
        </button>
        {!requiredDone && !pending && (
          <span className="text-xs text-muted-foreground">
            필수 {requiredTotal - requiredFilled}개 남음 · 살까 말까 섹션을 확인해주세요
          </span>
        )}
        <button
          type="button"
          onClick={() =>
            router.push(isEdit ? `/tastings/${edit!.tastingId}` : `/whiskies/${bottlingId}`)
          }
          className="rounded-md border border-border px-5 py-2 text-sm text-muted-foreground hover:border-foreground/30 hover:text-foreground"
        >
          취소
        </button>
        {isEdit &&
          (confirmDelete ? (
            <span className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-rose-300">정말 삭제할까요?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="rounded-md border border-rose-700 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/50 disabled:opacity-50"
              >
                {pending ? "삭제 중…" : "삭제"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              >
                취소
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-rose-700/40 px-3 py-1.5 text-xs text-rose-300/80 hover:border-rose-500/60 hover:text-rose-300"
            >
              <Trash2 className="size-3.5" />
              노트 삭제
            </button>
          ))}
      </div>
    </form>
  );
}

// ── 작은 UI 부속들 ─────────────────────────────────────────────────────

const fieldCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-amber-400 focus:outline-none";

type Step = {
  id: string;
  label: string;
  filled: number;
  total: number;
  done: boolean;
  required: boolean;
  hint?: string;
};

function StepIndicator({ steps }: { steps: Step[] }) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <nav
      aria-label="작성 진행"
      className="sticky top-14 z-30 flex items-stretch gap-2 rounded-lg border border-border bg-card/90 p-1.5 text-xs backdrop-blur supports-[backdrop-filter]:bg-card/70"
    >
      {steps.map((s, i) => {
        const active = s.required && !s.done;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollTo(s.id)}
            className={[
              "flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-left transition",
              s.done
                ? "bg-amber-400/10 text-amber-300"
                : active
                  ? "text-foreground hover:bg-secondary/60"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
            ].join(" ")}
            aria-current={active ? "step" : undefined}
          >
            <span
              aria-hidden
              className={[
                "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                s.done
                  ? "bg-amber-400 text-neutral-950"
                  : active
                    ? "border border-amber-400/60 text-amber-300"
                    : "border border-border text-muted-foreground",
              ].join(" ")}
            >
              {s.done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{s.label}</span>
              <span className="block truncate text-[10px] text-muted-foreground/80">
                {s.required
                  ? s.done
                    ? "완료"
                    : `${s.filled}/${s.total} 채움`
                  : s.hint ??
                    (s.total > 0 ? `${s.filled}/${s.total}` : "옵션")}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="font-serif text-xl tracking-tight">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Field({
  label, hint, required, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          {required && <span className="ml-1 text-amber-400">*</span>}
        </span>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function SegBtn({
  active, onClick, wide = true, children,
}: {
  active: boolean;
  onClick: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md border px-4 py-2 text-sm transition",
        wide ? "min-w-[120px]" : "min-w-[44px]",
        active
          ? "border-amber-400 bg-amber-400/10 text-amber-300"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ChipBtn({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-4 py-1.5 text-sm transition",
        active
          ? "border-amber-400 bg-amber-400/10 text-amber-300"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Slider10({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const set = value !== "";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className={set ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        {set ? (
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-amber-300">{value}</span>
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-[10px] text-muted-foreground hover:text-foreground"
              aria-label={`${label} 입력 취소`}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onChange("5")}
            title={`${label} 기록 시작`}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground/80 hover:border-foreground/30 hover:text-foreground"
          >
            <span aria-hidden>+</span> 기록
          </button>
        )}
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={set ? value : "5"}
        onChange={(e) => onChange(e.target.value)}
        disabled={!set}
        aria-label={`${label} 점수`}
        className={`w-full accent-amber-400 transition-opacity ${
          set ? "" : "cursor-not-allowed opacity-25"
        }`}
      />
    </div>
  );
}
