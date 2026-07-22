"use client";

import { useState, useTransition } from "react";
import { addToCollection } from "@/lib/collection/actions";

export function AddCollectionForm({ bottlingId }: { bottlingId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        setError(null);
        setOk(false);
        startTransition(async () => {
          const res = await addToCollection(fd);
          if (res?.error) setError(res.error);
          else setOk(true);
        });
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
    >
      <input type="hidden" name="bottling_id" value={bottlingId} />

      <label className="block text-xs">
        <span className="text-neutral-400">상태</span>
        <select
          name="status"
          className="mt-1 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        >
          <option value="owned">소장</option>
          <option value="opened">오픈됨</option>
          <option value="finished">비움</option>
          <option value="wishlist">위시리스트</option>
        </select>
      </label>

      <label className="block text-xs">
        <span className="text-neutral-400">구매가 (KRW)</span>
        <input
          name="purchase_price"
          type="number"
          min={0}
          className="mt-1 w-32 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
      </label>

      <label className="block flex-1 text-xs">
        <span className="text-neutral-400">메모</span>
        <input
          name="notes"
          className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
      </label>

      <button
        disabled={pending}
        className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
      >
        {pending ? "저장 중…" : "추가/갱신"}
      </button>

      {error && <p className="w-full text-sm text-red-300">{error}</p>}
      {ok && <p className="w-full text-sm text-emerald-300">컬렉션에 저장됐습니다.</p>}
    </form>
  );
}
