import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { computeDHash } from "@/lib/visual/dhash";

async function main() {
  const dirs = [
    path.join(process.cwd(), "test-assets"),
    path.join(process.cwd(), "public", "test-assets"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 1. Current Logo PNG (240x80)
  const currentLogoSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80">
      <rect width="240" height="80" fill="#16834A" />
      <rect x="12" y="12" width="56" height="56" fill="#B7F28B" rx="4"/>
      <text x="40" y="50" font-family="sans-serif" font-size="28" font-weight="900" fill="#17251C" text-anchor="middle">PL</text>
      <text x="80" y="42" font-family="sans-serif" font-size="20" font-weight="800" fill="#F4F1E8" letter-spacing="1.5">NOVA</text>
      <text x="80" y="60" font-family="sans-serif" font-size="11" font-weight="700" fill="#B7F28B" letter-spacing="2">CREATIVE</text>
    </svg>
  `);
  const currentLogoPng = await sharp(currentLogoSvg).png().toBuffer();
  const currentLogoHash = await computeDHash(currentLogoPng);

  // 2. Old Superseded Logo PNG (240x80)
  const oldLogoSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80">
      <rect width="240" height="80" fill="#2E2E2E" />
      <circle cx="40" cy="40" r="28" fill="#888888" />
      <text x="40" y="48" font-family="serif" font-size="24" font-weight="700" fill="#FFFFFF" text-anchor="middle">NC</text>
      <text x="82" y="42" font-family="serif" font-size="18" font-weight="600" fill="#CCCCCC">NOVA CORP</text>
      <text x="82" y="58" font-family="sans-serif" font-size="9" fill="#999999">LEGACY 2021</text>
    </svg>
  `);
  const oldLogoPng = await sharp(oldLogoSvg).png().toBuffer();
  const oldLogoHash = await computeDHash(oldLogoPng);

  // 3. On-Brand Banner PNG (600x300, 2:1 aspect ratio, contains current logo in top-left, approved colors only)
  const onBrandBannerSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <rect width="600" height="300" fill="#F4F1E8" />
      <!-- Current logo placed in top-left corner -->
      <g transform="translate(20, 20)">
        <rect width="180" height="60" fill="#16834A" rx="4"/>
        <rect x="8" y="8" width="44" height="44" fill="#B7F28B" rx="3"/>
        <text x="30" y="38" font-family="sans-serif" font-size="22" font-weight="900" fill="#17251C" text-anchor="middle">PL</text>
        <text x="62" y="33" font-family="sans-serif" font-size="16" font-weight="800" fill="#F4F1E8">NOVA</text>
        <text x="62" y="48" font-family="sans-serif" font-size="9" font-weight="700" fill="#B7F28B">CREATIVE</text>
      </g>
      <!-- Hero copy -->
      <rect x="20" y="100" width="560" height="170" fill="#17251C" rx="6"/>
      <text x="50" y="150" font-family="sans-serif" font-size="26" font-weight="800" fill="#B7F28B">ENTERPRISE CLOUD ARCHITECTURE</text>
      <text x="50" y="185" font-family="sans-serif" font-size="15" fill="#F4F1E8">Verified governance workflows for modern engineering operations.</text>
      <rect x="50" y="215" width="160" height="36" fill="#16834A" rx="3"/>
      <text x="130" y="238" font-family="sans-serif" font-size="12" font-weight="700" fill="#F4F1E8" text-anchor="middle">READ BENCHMARK</text>
    </svg>
  `);
  const onBrandBannerPng = await sharp(onBrandBannerSvg).png().toBuffer();

  // 4. Off-Palette Banner PNG (600x300, vibrant magenta and electric orange, covering > 50% of area)
  const offPaletteBannerSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
      <rect width="600" height="300" fill="#FF007F" />
      <rect x="40" y="40" width="520" height="220" fill="#FF6600" rx="8" />
      <text x="300" y="130" font-family="sans-serif" font-size="34" font-weight="900" fill="#FFFFFF" text-anchor="middle">FLASH SUMMER SALE</text>
      <text x="300" y="175" font-family="sans-serif" font-size="22" font-weight="700" fill="#FFFF00" text-anchor="middle">DISCOUNT 70% OFF EVERYTHING</text>
      <text x="300" y="215" font-family="sans-serif" font-size="16" fill="#FFFFFF" text-anchor="middle">Limited time offer. Terms apply.</text>
    </svg>
  `);
  const offPaletteBannerPng = await sharp(offPaletteBannerSvg).png().toBuffer();

  // Write files to both directories
  const files = [
    { name: "current-logo.png", buffer: currentLogoPng },
    { name: "old-logo.png", buffer: oldLogoPng },
    { name: "on-brand-banner.png", buffer: onBrandBannerPng },
    { name: "off-palette-banner.png", buffer: offPaletteBannerPng },
  ];

  for (const dir of dirs) {
    for (const f of files) {
      fs.writeFileSync(path.join(dir, f.name), f.buffer);
    }
  }

  console.log("Successfully generated test assets:");
  console.log("- current-logo.png (dHash:", currentLogoHash, ")");
  console.log("- old-logo.png (dHash:", oldLogoHash, ")");
  console.log("- on-brand-banner.png");
  console.log("- off-palette-banner.png");
}

main().catch((err) => {
  console.error("Error generating assets:", err);
  process.exit(1);
});
