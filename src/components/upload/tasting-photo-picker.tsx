"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { stripExifAndResize } from "@/lib/uploads/strip-exif";
import { TASTING_PHOTOS_BUCKET, tastingPhotoUrl } from "@/lib/uploads/storage";

const MAX_PHOTOS = 3;
const MAX_FILE_MB = 15;

type Props = {
  userId: string;
  paths: string[];
  onChange: (paths: string[]) => void;
};

export function TastingPhotoPicker({ userId, paths, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdd = paths.length < MAX_PHOTOS;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const slots = MAX_PHOTOS - paths.length;
    const list = Array.from(files).slice(0, slots);

    setPending(true);
    try {
      const supabase = createClient();
      const uploaded: string[] = [];
      for (const file of list) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          throw new Error(`${file.name}: ${MAX_FILE_MB}MB 이하만 가능`);
        }
        const blob = await stripExifAndResize(file);
        const filename = `${crypto.randomUUID()}.jpg`;
        const path = `${userId}/${filename}`;
        const { error: upErr } = await supabase.storage
          .from(TASTING_PHOTOS_BUCKET)
          .upload(path, blob, {
            contentType: "image/jpeg",
            cacheControl: "31536000",
            upsert: false,
          });
        if (upErr) throw new Error(upErr.message);
        uploaded.push(path);
      }
      onChange([...paths, ...uploaded]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeAt(idx: number) {
    const target = paths[idx];
    if (!target) return;
    onChange(paths.filter((_, i) => i !== idx));
    // storage에서도 지움 (실패해도 form 상태는 갱신됨)
    try {
      const supabase = createClient();
      await supabase.storage.from(TASTING_PHOTOS_BUCKET).remove([target]);
    } catch {
      // ignore — orphan 파일은 정기 정리
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {paths.map((p, i) => {
          const url = tastingPhotoUrl(p);
          return (
            <div
              key={p}
              className="relative h-24 w-24 overflow-hidden rounded border border-neutral-800 bg-neutral-950"
            >
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-1 top-1 rounded bg-black/70 px-1.5 text-xs text-neutral-200 hover:bg-red-900/80 hover:text-red-100"
                aria-label="사진 제거"
              >
                ×
              </button>
            </div>
          );
        })}

        {canAdd && (
          <label
            className={
              "flex h-24 w-24 cursor-pointer items-center justify-center rounded border border-dashed border-neutral-700 text-xs text-neutral-500 hover:border-amber-500 hover:text-amber-300 " +
              (pending ? "pointer-events-none opacity-50" : "")
            }
          >
            <span>{pending ? "업로드 중…" : `+ 사진 (${paths.length}/${MAX_PHOTOS})`}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={pending}
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </label>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
