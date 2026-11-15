import { describe, it, expect } from "vitest";
import { diffWordsWithSpace } from "diff";

describe("Intent-Preserving Rewrite Engine", () => {
  it("calculates word-level diffs correctly", () => {
    const original = "Our platform increases productivity by 300%.";
    const replacement = "Our platform improved task completion time by 18% in an internal pilot.";

    const diff = diffWordsWithSpace(original, replacement);

    expect(diff.length).toBeGreaterThan(1);
    expect(diff.some((p) => p.removed && p.value.includes("300"))).toBe(true);
    expect(diff.some((p) => p.added && p.value.includes("18"))).toBe(true);
  });

  it("replaces exact flagged span while leaving surrounding copy untouched", () => {
    const fullBody = "Headline: Work faster. Our platform increases productivity by 300%. Sign up today.";
    const excerpt = "increases productivity by 300%";
    const suggested = "improved task completion time by 18% in an internal pilot (individual results may vary)";

    const newBody = fullBody.replace(excerpt, suggested);

    expect(newBody).toContain("Headline: Work faster.");
    expect(newBody).toContain("Sign up today.");
    expect(newBody).toContain("improved task completion time by 18%");
    expect(newBody).not.toContain("300%");
  });
});
