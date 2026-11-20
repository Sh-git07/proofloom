import sharp from "sharp";

/**
 * Computes a 64-bit difference hash (dHash) for an image buffer.
 * Algorithm:
 * 1. Grayscale conversion.
 * 2. Resize to 9 columns x 8 rows (flat 72 pixels).
 * 3. Compare adjacent horizontal pixels (left > right -> 1, else 0).
 * 4. Yields an exact 64-bit binary string.
 */
export async function computeDHash(imageBuffer: Buffer): Promise<string> {
  const { data } = await sharp(imageBuffer)
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = "";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const left = data[r * 9 + c];
      const right = data[r * 9 + c + 1];
      hash += left > right ? "1" : "0";
    }
  }

  return hash;
}

/**
 * Calculates the Hamming distance between two binary hashes.
 */
export function hammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) {
    return 64; // Maximum distance on mismatched lengths
  }

  let dist = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) {
      dist++;
    }
  }
  return dist;
}

export interface MultiRegionHashes {
  whole: string;
  crops: Array<{
    region: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "centre";
    hash: string;
  }>;
}

/**
 * Computes dHash for the full image plus five key candidate regions
 * (four corners and the centre) to locate placed logos/emblems.
 */
export async function computeMultiRegionDHashes(
  imageBuffer: Buffer
): Promise<MultiRegionHashes> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const width = metadata.width || 100;
  const height = metadata.height || 100;

  const wholeHash = await computeDHash(imageBuffer);

  const cropWidth = Math.max(10, Math.floor(width * 0.35));
  const cropHeight = Math.max(10, Math.floor(height * 0.35));

  const centreX = Math.max(0, Math.floor((width - cropWidth) / 2));
  const centreY = Math.max(0, Math.floor((height - cropHeight) / 2));

  const cropDefinitions = [
    { region: "top-left" as const, left: 0, top: 0, width: cropWidth, height: cropHeight },
    { region: "top-right" as const, left: Math.max(0, width - cropWidth), top: 0, width: cropWidth, height: cropHeight },
    { region: "bottom-left" as const, left: 0, top: Math.max(0, height - cropHeight), width: cropWidth, height: cropHeight },
    { region: "bottom-right" as const, left: Math.max(0, width - cropWidth), top: Math.max(0, height - cropHeight), width: cropWidth, height: cropHeight },
    { region: "centre" as const, left: centreX, top: centreY, width: cropWidth, height: cropHeight },
  ];

  const crops: MultiRegionHashes["crops"] = [];

  for (const def of cropDefinitions) {
    try {
      const croppedBuffer = await sharp(imageBuffer)
        .extract({
          left: def.left,
          top: def.top,
          width: Math.min(def.width, width - def.left),
          height: Math.min(def.height, height - def.top),
        })
        .toBuffer();

      const cropHash = await computeDHash(croppedBuffer);
      crops.push({ region: def.region, hash: cropHash });
    } catch {
      // If crop fails due to dimension bounds, omit that region
    }
  }

  return {
    whole: wholeHash,
    crops,
  };
}

/**
 * Compares an image (whole + crops) against an approved logo's hash.
 * Returns the minimum Hamming distance and the matching region.
 */
export function matchLogoAgainstHashes(
  multiHashes: MultiRegionHashes,
  targetHash: string,
  threshold: number = 12
): { isMatch: boolean; minDistance: number; matchedRegion: string } {
  let minDistance = hammingDistance(multiHashes.whole, targetHash);
  let matchedRegion = "whole";

  for (const crop of multiHashes.crops) {
    const dist = hammingDistance(crop.hash, targetHash);
    if (dist < minDistance) {
      minDistance = dist;
      matchedRegion = crop.region;
    }
  }

  return {
    isMatch: minDistance <= threshold,
    minDistance,
    matchedRegion,
  };
}
