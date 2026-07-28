// Storage path → URL 변환.
//   bottling-images, tasting-photos: public bucket → deterministic public URL
//   post-photos: private bucket (2026-07-28~) → signed URL 필요

import type { SupabaseClient } from "@supabase/supabase-js";

export const BOTTLING_IMAGES_BUCKET = "bottling-images";
export const TASTING_PHOTOS_BUCKET  = "tasting-photos";
export const POST_PHOTOS_BUCKET     = "post-photos";

const POST_SIGNED_URL_TTL_SEC = 3600; // 1시간

function publicUrl(bucket: string, pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${pathOrUrl}`;
}

export function bottlingImageUrl(pathOrUrl: string | null | undefined): string | null {
  return publicUrl(BOTTLING_IMAGES_BUCKET, pathOrUrl);
}

export function tastingPhotoUrl(pathOrUrl: string | null | undefined): string | null {
  return publicUrl(TASTING_PHOTOS_BUCKET, pathOrUrl);
}

// ── post-photos signed URL (private bucket) ──
// 단일 경로 → signed URL
export async function postPhotoSignedUrl(
  supabase: SupabaseClient,
  pathOrUrl: string | null | undefined,
): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
  const { data, error } = await supabase.storage
    .from(POST_PHOTOS_BUCKET)
    .createSignedUrl(pathOrUrl, POST_SIGNED_URL_TTL_SEC);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// 배치: 여러 경로 → 각각의 signed URL (createSignedUrls 사용, 실패한 것은 null)
export async function postPhotoSignedUrls(
  supabase: SupabaseClient,
  paths: string[],
): Promise<Array<string | null>> {
  if (paths.length === 0) return [];
  // absolute URL은 그대로 유지 (외부 URL 지원)
  const bucketPaths: string[] = [];
  const positions: number[] = []; // paths 배열 인덱스
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (!p || p.startsWith("http")) continue;
    bucketPaths.push(p);
    positions.push(i);
  }
  if (bucketPaths.length === 0) {
    return paths.map((p) => (p && p.startsWith("http") ? p : null));
  }
  const { data } = await supabase.storage
    .from(POST_PHOTOS_BUCKET)
    .createSignedUrls(bucketPaths, POST_SIGNED_URL_TTL_SEC);
  const result: Array<string | null> = new Array(paths.length).fill(null);
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (p && p.startsWith("http")) result[i] = p;
  }
  if (data) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const originalIdx = positions[i];
      result[originalIdx] = item?.signedUrl ?? null;
    }
  }
  return result;
}
