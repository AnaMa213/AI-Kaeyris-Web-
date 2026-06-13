import { describe, expect, test } from "vitest";
import { computeReadingAids } from "@/lib/markdown/readingAids";

describe("computeReadingAids", () => {
  test("returns zero aids for empty markdown", () => {
    expect(computeReadingAids("   \n\t  ")).toEqual({
      wordCount: 0,
      readingMinutes: 0,
    });
  });

  test("counts words after removing markdown syntax and code", () => {
    const markdown = `
# Heading Title

Intro **bold words** with [visible link](https://example.test) and ![ignored alt](image.png).

> Quote line survives

- First item
- second item with \`inline code ignored\`

1. Numbered item

\`\`\`ts
const ignored = true;
\`\`\`

---

_fin_
`;

    expect(computeReadingAids(markdown)).toEqual({
      wordCount: 20,
      readingMinutes: 1,
    });
  });

  test("rounds reading minutes at 250 words per minute with a non-empty floor", () => {
    expect(computeReadingAids("single")).toEqual({
      wordCount: 1,
      readingMinutes: 1,
    });

    expect(computeReadingAids(Array.from({ length: 375 }, () => "word").join(" "))).toEqual({
      wordCount: 375,
      readingMinutes: 2,
    });
  });
});
