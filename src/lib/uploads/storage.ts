// Storage path → public URL 변환.
// bucket이 public이면 이 패턴이 deterministic.

export const BOTTLING_IMAGES_BUCKET = "bottling-images";
export const TASTING_PHOTOS_BUCKET  = "tasting-photos";
export const POST_PHOTOS_BUCKET     = "post-photos";

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

export function postPhotoUrl(pathOrUrl: string | null | undefined): string | null {
  return publicUrl(POST_PHOTOS_BUCKET, pathOrUrl);
}
