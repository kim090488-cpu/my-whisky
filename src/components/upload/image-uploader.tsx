"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { stripExifAndResize } from "@/lib/uploads/strip-exif";
import { recordBottlingImage } from "@/lib/uploads/actions";
import { BOTTLING_IMAGES_BUCKET } from "@/lib/uploads/storage";

const MAX_FILE_MB = 15;

export function BottlingImageUploader({ bottlingId }: { bottlingId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`${MAX_FILE_MB}MB 이하 파일만 가능합니다.`);
      return;
    }

    setPending(true);
    try {
      const blob = await stripExifAndResize(file);
      setPreview(URL.createObjectURL(blob));

      const supabase = createClient();
      const filename = `${crypto.randomUUID()}.jpg`;
      const path = `${bottlingId}/${filename}`;

      const { error: uploadErr } = await supabase.storage
        .from(BOTTLING_IMAGES_BUCKET)
        .upload(path, blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000", // 1년 — 이미지는 변경 X (덮어쓰지 않음)
          upsert: false,
        });
      if (uploadErr) throw new Error(uploadErr.message);

      const fd = new FormData();
      fd.set("bottling_id", bottlingId);
      fd.set("storage_path", path);
      const res = await recordBottlingImage(fd);
      if (res?.error) throw new Error(res.error);

      router.refresh();
      // preview 유지하면 갤러리 갱신과 중복돼 어색 — 초기화
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-400/20">
        <span>📷</span>
        <span>{pending ? "업로드 중…" : "라벨 사진 추가"}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={pending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
        />
      </label>

      {preview && (
        <div className="mt-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-20 rounded border border-neutral-800" />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
