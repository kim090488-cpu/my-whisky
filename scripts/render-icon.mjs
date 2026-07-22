import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());

// ─── Symbol pictograms (line illustrations) ─────────────────────────
function whiskySymbol(stroke) {
  // Lowball tumbler glass — simple line drawing
  return `
  <g stroke="${stroke}" stroke-width="14" fill="none"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M 408 280 L 408 440 Q 408 460 428 460 L 596 460 Q 616 460 616 440 L 616 280"/>
    <line x1="408" y1="280" x2="616" y2="280"/>
    <line x1="428" y1="385" x2="596" y2="385" opacity="0.5"/>
  </g>`;
}

function michelinSymbol(stroke) {
  // Crossed fork & knife — minimal premium
  return `
  <g stroke="${stroke}" stroke-width="14" fill="none"
     stroke-linecap="round" stroke-linejoin="round">
    <!-- Fork stem + tines -->
    <line x1="448" y1="310" x2="448" y2="460"/>
    <line x1="424" y1="280" x2="424" y2="340"/>
    <line x1="436" y1="280" x2="436" y2="340"/>
    <line x1="460" y1="280" x2="460" y2="340"/>
    <line x1="472" y1="280" x2="472" y2="340"/>
    <path d="M 424 340 Q 448 360 472 340"/>
    <!-- Knife blade + handle -->
    <line x1="576" y1="360" x2="576" y2="460"/>
    <path d="M 576 280 Q 596 290 596 320 L 596 360 L 556 360 Q 556 320 576 280 Z"/>
  </g>`;
}

// ─── Concept color systems (the BRAND backgrounds) ──────────────────
const concepts = {
  atelier: {
    bg: "#EFE3CB",      // warm cream parchment
    border: "#1F1409",
    borderOpacity: 0.18,
    mySerifColor: "#7A5A30",
    nameColor: "#1F1409",
    symbolColor: "#1F1409",
  },
  onyx: {
    bg: "#0F0E0C",      // deep matte black
    border: "#C6A05E",
    borderOpacity: 0.25,
    mySerifColor: "#C6A05E",
    nameColor: "#F0E6D0",
    symbolColor: "#C6A05E",
  },
  sage: {
    bg: "#B8C0A5",      // muted boutique sage
    border: "#1F2618",
    borderOpacity: 0.20,
    mySerifColor: "#4A553A",
    nameColor: "#1F2618",
    symbolColor: "#1F2618",
  },
};

function buildIcon(concept, appName, symbolFn) {
  const c = concepts[concept];
  return `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="180" fill="${c.bg}"/>

  <!-- Subtle inner frame — the signature element -->
  <rect x="56" y="56" width="912" height="912" rx="140"
        fill="none" stroke="${c.border}" stroke-width="4" opacity="${c.borderOpacity}"/>

  <!-- Symbol illustration (top) -->
  ${symbolFn(c.symbolColor)}

  <!-- "My" italic serif (small, signature) -->
  <text x="512" y="660"
        font-family="Georgia, 'Times New Roman', serif"
        font-style="italic"
        font-size="92"
        text-anchor="middle"
        fill="${c.mySerifColor}">My</text>

  <!-- App name (bold, large) -->
  <text x="512" y="850"
        font-family="Georgia, 'Times New Roman', 'Malgun Gothic', '맑은 고딕', serif"
        font-weight="900"
        font-size="170"
        text-anchor="middle"
        fill="${c.nameColor}"
        letter-spacing="-4">${appName}</text>
</svg>`;
}

const apps = [
  { name: "Whisky", symbol: whiskySymbol, file: "whisky" },
  { name: "미슐랭", symbol: michelinSymbol, file: "michelin" },
];

const conceptNames = Object.keys(concepts);
const sizes = [1024, 512, 256];

for (const concept of conceptNames) {
  for (const app of apps) {
    const svg = buildIcon(concept, app.name, app.symbol);
    const base = `icon-${concept}-${app.file}`;
    writeFileSync(resolve(root, "public", `${base}.svg`), svg);

    for (const size of sizes) {
      await sharp(Buffer.from(svg), { density: 600 })
        .resize(size, size)
        .png()
        .toFile(resolve(root, "public", `${base}-${size}.png`));
    }
    console.log(`  ✓ ${base}`);
  }
}

console.log("Done.");
