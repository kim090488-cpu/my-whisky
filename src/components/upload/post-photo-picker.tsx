"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { stripExifAndResize } from "@/lib/uploads/strip-exif";
import { POST_PHOTOS_BUCKET } from "@/lib/uploads/storage";

const MAX_PHOTOS = 10;
const MAX_FILE_MB = 15;
const SIGNED_URL_TTL_SEC = 3600;

type Props = {
  userId: string;
  paths: string[];
  onChange: (paths: string[]) => void;
};

export function PostPhotoPicker({ userId, paths, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const canAdd = paths.length < MAX_PHOTOS;

  // paths 변화 → 아직 URL 없는 경로에 대해 signed URL 발급
  useEffect(() => {
    const missing = paths.filter((p) => !previewUrls[p]);
    if (missing.length === 0) return;
    const supabase = createClient();
    supabase.storage
      .from(POST_PHOTOS_BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_SEC)
      .then(({ data }) => {
        if (!data) return;
        setPreviewUrls((prev) => {
          const next = { ...prev };
          for (let i = 0; i < data.length; i++) {
            const url = data[i]?.signedUrl;
            if (url) next[missing[i]] = url;
          }
          return next;
        });
      });
  }, [paths, previewUrls]);

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
          .from(POST_PHOTOS_BUCKET)
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
    try {
      const supabase = createClient();
      await supabase.storage.from(POST_PHOTOS_BUCKET).remove([target]);
    } catch {
      // orphan은 정기 정리
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {paths.map((p, i) => {
          const url = previewUrls[p];
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
