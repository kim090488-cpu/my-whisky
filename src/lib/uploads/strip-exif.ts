// 브라우저에서 EXIF 메타데이터 제거 + 리사이즈.
// Canvas로 다시 그리면 EXIF는 자연히 사라지고, 동시에 긴 변 기준 MAX_EDGE 로 축소.
// JPEG 0.85 품질로 인코딩 — 라벨 사진엔 충분.

const MAX_EDGE = 2048;
const JPEG_QUALITY = 0.85;

export async function stripExifAndResize(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 가능합니다.");
  }

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context를 만들 수 없어요.");
  ctx.drawImage(img, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지 인코딩 실패"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
    img.src = src;
  });
}
