import { describe, expect, it } from "vitest";
import { plainTextToSafeHtml, sanitizeContentHtml } from "@/lib/security/sanitize-content";

describe("content sanitizer", () => {
  it("keeps the editorial allowlist and removes executable markup", () => {
    const result = sanitizeContentHtml('<h2 onclick="evil()">Chuyện họ</h2><script>alert(1)</script><img src=x onerror=evil()><p><strong>Ghi nhớ</strong> <a href="javascript:evil()">xấu</a> <a href="https://example.com">tốt</a></p>');
    expect(result).toContain("<h2>Chuyện họ</h2>");
    expect(result).toContain("<strong>Ghi nhớ</strong>");
    expect(result).toContain('href="https://example.com"');
    expect(result).not.toMatch(/script|onclick|onerror|javascript|<img/i);
  });

  it("escapes plain text before turning paragraphs into HTML", () => {
    expect(plainTextToSafeHtml("Một <script>x</script>\n\nHai")).toBe("<p>Một </p><p>Hai</p>");
  });
});
