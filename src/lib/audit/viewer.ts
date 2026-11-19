export interface ViewerFinding {
  id: string;
  category: string;
  severity: string;
  excerpt: string;
  start_index: number;
  end_index: number;
  explanation?: string;
  is_resolved?: boolean;
}

export interface ViewerSegment<T extends ViewerFinding = ViewerFinding> {
  start: number;
  end: number;
  text: string;
  coveringFindings: T[];
}

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

/**
 * Builds merged, non-overlapping character ranges so every character
 * of the submitted text appears exactly once.
 * For each range covered by one or more findings, findings are sorted
 * with the most severe finding first.
 */
export function buildViewerSegments<T extends ViewerFinding>(
  text: string,
  findings: T[]
): Array<ViewerSegment<T>> {
  if (!text) return [];
  if (!findings || findings.length === 0) {
    return [{ start: 0, end: text.length, text, coveringFindings: [] }];
  }

  const length = text.length;

  // Collect all cut points (normalized between 0 and length)
  const points = new Set<number>([0, length]);
  for (const f of findings) {
    let start = Math.max(0, Math.min(length, f.start_index));
    let end = Math.max(start, Math.min(length, f.end_index));
    if (start === end && f.excerpt && text.includes(f.excerpt)) {
      const idx = text.indexOf(f.excerpt);
      if (idx !== -1) {
        start = idx;
        end = idx + f.excerpt.length;
      }
    }
    points.add(start);
    points.add(end);
  }

  const sortedPoints = Array.from(points).sort((a, b) => a - b);
  const rawSegments: Array<ViewerSegment<T>> = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const start = sortedPoints[i];
    const end = sortedPoints[i + 1];
    if (start >= end) continue;

    // Find all findings whose range covers this cut interval [start, end]
    const covering = findings.filter((f) => {
      let fStart = Math.max(0, Math.min(length, f.start_index));
      let fEnd = Math.max(fStart, Math.min(length, f.end_index));
      if (fStart === fEnd && f.excerpt && text.includes(f.excerpt)) {
        const idx = text.indexOf(f.excerpt);
        if (idx !== -1) {
          fStart = idx;
          fEnd = idx + f.excerpt.length;
        }
      }
      return fStart <= start && fEnd >= end;
    });

    // Sort covering findings with most severe first
    covering.sort((a, b) => {
      const rankA = SEVERITY_RANK[a.severity] ?? 0;
      const rankB = SEVERITY_RANK[b.severity] ?? 0;
      return rankB - rankA;
    });

    rawSegments.push({
      start,
      end,
      text: text.slice(start, end),
      coveringFindings: covering,
    });
  }

  // Merge adjacent segments that share the exact same set of covering findings
  const merged: Array<ViewerSegment<T>> = [];
  for (const seg of rawSegments) {
    if (merged.length === 0) {
      merged.push(seg);
      continue;
    }

    const prev = merged[merged.length - 1];
    const prevIds = prev.coveringFindings.map((f) => f.id).join(",");
    const currIds = seg.coveringFindings.map((f) => f.id).join(",");

    if (prevIds === currIds) {
      prev.end = seg.end;
      prev.text += seg.text;
    } else {
      merged.push(seg);
    }
  }

  return merged;
}
