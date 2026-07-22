"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createPost } from "@/lib/posts/actions";
import { PostPhotoPicker } from "@/components/upload/post-photo-picker";
import type { PostVisibility } from "@/types/database";

type PrefillBottling = {
  id: string;
  name: string;
  name_kr: string | null;
  distillery_name: string;
  distillery_name_kr: string | null;
};

type Props = {
  userId: string;
  prefillBottling: PrefillBottling | null;
};

export function PostForm({ userId, prefillBottling }: Props) {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [bottling, setBottling] = useState<PrefillBottling | null>(prefillBottling);
  const [locationName, setLocationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (photos.length === 0) {
      setError("사진을 한 장 이상 올려주세요.");
      return;
    }

    const fd = new FormData();
    fd.set("photos", JSON.stringify(photos));
    fd.set("body", body);
    fd.set("visibility", visibility);
    if (bottling) fd.set("bottling_id", bottling.id);
    if (locationName) fd.set("location_name", locationName);

    startTransition(async () => {
      const res = await createPost(fd);
      if (res?.error) setError(res.error);
      // 성공 시 createPost가 redirect 함
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 사진 */}
      <div>
        <Label>사진 (최대 10장)</Label>
        <div className="mt-2">
          <PostPhotoPicker userId={userId} paths={photos} onChange={setPhotos} />
        </div>
      </div>

      {/* 캡션 */}
      <div>
        <Label>캡션</Label>
        <textarea
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="이 순간에 대해 한 줄… (선택)"
          maxLength={2000}
          className="mt-2 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
        <p className="mt-1 text-right text-[10px] text-neutral-600">
          {body.length} / 2000
        </p>
      </div>

      {/* 보틀 태그 */}
      <div>
        <Label>위스키 태그 (선택)</Label>
        {bottling ? (
          <div className="mt-2 flex items-center justify-between rounded-md border border-amber-700/40 bg-amber-400/5 px-3 py-2 text-sm">
            <span>
              <span className="text-amber-300">🥃</span>{" "}
              <span className="font-medium">{bottling.distillery_name_kr ?? bottling.distillery_name}</span>{" "}
              <span className="text-muted-foreground">·</span>{" "}
              {bottling.name_kr ?? bottling.name}
            </span>
            <button
              type="button"
              onClick={() => setBottling(null)}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="태그 제거"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            보틀 페이지에서 "+ 모먼트" 누르고 들어오면 자동 태그 됩니다.
          </p>
        )}
      </div>

      {/* 장소 */}
      <div>
        <Label>장소 (선택)</Label>
        <input
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="예: 강남 OO 바, 집"
          maxLength={100}
          className="mt-2 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        />
      </div>

      {/* 공개 범위 */}
      <div>
        <Label>공개 범위</Label>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as PostVisibility)}
          className="mt-2 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
        >
          <option value="public">공개</option>
          <option value="followers">팔로워만</option>
          <option value="private">비공개</option>
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/40 bg-red-900/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-neutral-900 pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-amber-400 px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "올리는 중…" : "공유하기"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-neutral-700 px-5 py-2 text-sm hover:border-neutral-500"
        >
          취소
        </button>
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
      {children}
    </span>
  );
}
