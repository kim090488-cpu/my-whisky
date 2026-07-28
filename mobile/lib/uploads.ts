import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabase";

export const TASTING_PHOTOS_BUCKET = "tasting-photos";
export const BOTTLING_IMAGES_BUCKET = "bottling-images";
export const POST_PHOTOS_BUCKET = "post-photos";

const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

/**
 * 갤러리에서 사진 1장 선택 → 리사이즈·JPEG 재인코딩 (EXIF 제거)
 *   → Supabase Storage에 업로드 → storage path 반환.
 *   사용자 거부/취소 시 null.
 */
export async function pickAndUploadTastingPhoto(
  userId: string,
): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("사진 라이브러리 권한이 필요해요.");
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1, // 원본 → 아래서 manipulator로 재압축
    allowsEditing: false,
    exif: false,
  });
  if (picked.canceled || picked.assets.length === 0) return null;

  const asset = picked.assets[0];

  // 리사이즈 + JPEG 재인코딩 (EXIF 자동 제거)
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: MAX_EDGE } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );

  // RN fetch는 file:// URI 지원 → ArrayBuffer 로 변환 후 Supabase에 업로드
  const res = await fetch(manipulated.uri);
  const arrayBuffer = await res.arrayBuffer();

  const filename = `${uuid()}.jpg`;
  const path = `${userId}/${filename}`;

  const { error } = await supabase.storage
    .from(TASTING_PHOTOS_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) throw new Error(error.message);

  return path;
}

export async function deleteTastingPhoto(path: string): Promise<void> {
  await supabase.storage.from(TASTING_PHOTOS_BUCKET).remove([path]);
}

export async function pickAndUploadPostPhoto(
  userId: string,
): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("사진 라이브러리 권한이 필요해요.");
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsEditing: false,
    exif: false,
  });
  if (picked.canceled || picked.assets.length === 0) return null;
  const asset = picked.assets[0];

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: MAX_EDGE } }],
    { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  const res = await fetch(manipulated.uri);
  const arrayBuffer = await res.arrayBuffer();

  const filename = `${uuid()}.jpg`;
  const path = `${userId}/${filename}`;

  const { error } = await supabase.storage
    .from(POST_PHOTOS_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return path;
}

export async function deletePostPhoto(path: string): Promise<void> {
  await supabase.storage.from(POST_PHOTOS_BUCKET).remove([path]);
}

export function tastingPhotoUrl(pathOrUrl: string | null | undefined): string | null {
  return publicUrl(TASTING_PHOTOS_BUCKET, pathOrUrl);
}

export function bottlingImageUrl(pathOrUrl: string | null | undefined): string | null {
  return publicUrl(BOTTLING_IMAGES_BUCKET, pathOrUrl);
}

// ── post-photos signed URL (private bucket, 2026-07-28~) ──
const POST_SIGNED_URL_TTL_SEC = 3600;

export async function postPhotoSignedUrl(
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

export async function postPhotoSignedUrls(
  paths: (string | null | undefined)[],
): Promise<Array<string | null>> {
  if (paths.length === 0) return [];
  const bucketPaths: string[] = [];
  const positions: number[] = [];
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (!p || p.startsWith("http")) continue;
    bucketPaths.push(p);
    positions.push(i);
  }
  const result: Array<string | null> = new Array(paths.length).fill(null);
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (p && p.startsWith("http")) result[i] = p;
  }
  if (bucketPaths.length === 0) return result;
  const { data } = await supabase.storage
    .from(POST_PHOTOS_BUCKET)
    .createSignedUrls(bucketPaths, POST_SIGNED_URL_TTL_SEC);
  if (data) {
    for (let i = 0; i < data.length; i++) {
      result[positions[i]] = data[i]?.signedUrl ?? null;
    }
  }
  return result;
}

function publicUrl(bucket: string, p: string | null | undefined): string | null {
  if (!p) return null;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${p}`;
}

// 외부 의존성 추가 없이 UUID v4 생성 (Math.random 기반 — Supabase storage path용 충분)
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
