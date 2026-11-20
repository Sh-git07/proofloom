import sharp from "sharp";

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

export const APPROVED_BRAND_PALETTE: string[] = [
  "#16834A", // Nova Forest Green
  "#B7F28B", // Signal Lime
  "#17251C", // Nova Deep Ink
  "#F4F1E8", // Blueprint Paper
  "#253C2B", // Deep Brutalist Border Green
  "#637367", // Muted Sage Text
  "#FFFFFF", // Neutral Clean White
  "#000000", // Neutral True Black
];

/**
 * Parses a hex string (#RRGGBB or #RGB) into RGB components.
 */
export function hexToRgb(hex: string): RgbColor {
  let cleaned = hex.replace("#", "").trim();
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts sRGB [0-255] to CIELAB (D65 standard illuminant).
 */
export function rgbToLab(rgb: RgbColor): LabColor {
  // 1. Linearize sRGB
  const rLin = (rgb.r / 255 > 0.04045 ? Math.pow((rgb.r / 255 + 0.055) / 1.055, 2.4) : (rgb.r / 255) / 12.92) * 100;
  const gLin = (rgb.g / 255 > 0.04045 ? Math.pow((rgb.g / 255 + 0.055) / 1.055, 2.4) : (rgb.g / 255) / 12.92) * 100;
  const bLin = (rgb.b / 255 > 0.04045 ? Math.pow((rgb.b / 255 + 0.055) / 1.055, 2.4) : (rgb.b / 255) / 12.92) * 100;

  // 2. Linear RGB to XYZ (D65)
  const x = rLin * 0.4124564 + gLin * 0.3575761 + bLin * 0.1804375;
  const y = rLin * 0.2126729 + gLin * 0.7151522 + bLin * 0.072175;
  const z = rLin * 0.0193339 + gLin * 0.119192 + bLin * 0.9503041;

  // 3. XYZ to Lab (Reference white D65: Xn=95.047, Yn=100.0, Zn=108.883)
  const xr = x / 95.047;
  const yr = y / 100.0;
  const zr = z / 108.883;

  const fx = xr > 0.008856 ? Math.cbrt(xr) : 7.787 * xr + 16 / 116;
  const fy = yr > 0.008856 ? Math.cbrt(yr) : 7.787 * yr + 16 / 116;
  const fz = zr > 0.008856 ? Math.cbrt(zr) : 7.787 * zr + 16 / 116;

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Calculates standard Euclidean deltaE (CIE76) between two Lab colors.
 */
export function deltaE(c1: LabColor, c2: LabColor): number {
  const dL = c1.L - c2.L;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Evaluates whether an image buffer adheres to an approved color palette.
 * Analyzes pixel samples, measures minimum deltaE to the approved palette,
 * and flags if off-palette colors exceed the 15% threshold.
 */
export async function analyzeColorPaletteCompliance(
  imageBuffer: Buffer,
  approvedHexPalette: string[] = APPROVED_BRAND_PALETTE,
  thresholdPercentage: number = 15.0,
  maxAllowedDeltaE: number = 18.0
): Promise<{
  isOffPalette: boolean;
  offPalettePercentage: number;
  dominantOffColors: string[];
  totalPixelsSampled: number;
}> {
  // Downsample to 64x64 raw RGB buffer (4,096 pixels) for fast deterministic analysis
  const { data, info } = await sharp(imageBuffer)
    .resize(64, 64, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  const approvedLabs = approvedHexPalette.map((hex) => rgbToLab(hexToRgb(hex)));

  let offPaletteCount = 0;
  const offColorCounts = new Map<string, number>();

  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const pixelLab = rgbToLab({ r, g, b });

    // Calculate minimum deltaE to any approved brand color
    let minDiff = Infinity;
    for (const appLab of approvedLabs) {
      const diff = deltaE(pixelLab, appLab);
      if (diff < minDiff) {
        minDiff = diff;
      }
    }

    if (minDiff > maxAllowedDeltaE) {
      offPaletteCount++;
      // Quantize hex into 16-level buckets for reporting dominant off colors
      const qr = Math.round(r / 16) * 16;
      const qg = Math.round(g / 16) * 16;
      const qb = Math.round(b / 16) * 16;
      const hex = `#${((1 << 24) + (Math.min(255, qr) << 16) + (Math.min(255, qg) << 8) + Math.min(255, qb))
        .toString(16)
        .slice(1)
        .toUpperCase()}`;
      offColorCounts.set(hex, (offColorCounts.get(hex) || 0) + 1);
    }
  }

  const offPalettePercentage = Math.round((offPaletteCount / totalPixels) * 1000) / 10;
  const isOffPalette = offPalettePercentage > thresholdPercentage;

  // Extract top 3 most prevalent off-palette color hexes
  const dominantOffColors = Array.from(offColorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hex]) => hex);

  return {
    isOffPalette,
    offPalettePercentage,
    dominantOffColors,
    totalPixelsSampled: totalPixels,
  };
}
