// 1회성 유틸: Play Store 피처 그래픽 1024×500 PNG 생성.
// 실행: node scripts/make-feature-graphic.mjs
// 결과: docs/play-feature-graphic.png

import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const iconPath = resolve(root, "public/icon-512.png");
const outPath = resolve(root, "docs/play-feature-graphic.png");

const W = 1024;
const H = 500;

// 배경 (다크 톤 + 우측 하단 앰버 글로우 힌트)
const bgSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#1a1310"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="1.1" r="0.6">
      <stop offset="0%" stop-color="rgba(251,191,36,0.25)"/>
      <stop offset="100%" stop-color="rgba(251,191,36,0)"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#fbbf24"/>
</svg>
`;

// 텍스트 오버레이 (한글 폰트는 sans-serif → 시스템 폰트 fallback)
const textSvg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .brand { font-family: "Malgun Gothic", "Noto Sans KR", "AppleGothic", sans-serif; font-weight: 800; }
    .sub   { font-family: "Malgun Gothic", "Noto Sans KR", "AppleGothic", sans-serif; font-weight: 600; }
    .foot  { font-family: "Malgun Gothic", "Noto Sans KR", "AppleGothic", sans-serif; font-weight: 400; }
  </style>
  <text x="420" y="200" class="brand" font-size="88" fill="#fbbf24">my-whisky</text>
  <text x="420" y="280" class="sub"   font-size="46" fill="#f5f5f5">위스키 커뮤니티</text>
  <text x="420" y="360" class="foot"  font-size="26" fill="#a3a3a3">AI 큐레이터 · 테이스팅 노트 · 컬렉션</text>
</svg>
`;

// 아이콘: 320×320으로 리사이즈 후 좌측 중앙
const iconResized = await sharp(iconPath)
  .resize(320, 320, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

const bg = await sharp(Buffer.from(bgSvg)).png().toBuffer();

await sharp(bg)
  .composite([
    { input: iconResized, top: (H - 320) / 2, left: 60 },
    { input: Buffer.from(textSvg), top: 0, left: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log(`✓ Wrote ${outPath} (1024×500)`);
