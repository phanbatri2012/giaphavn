import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const paths = [
  "/",
  "/site/demo-hong-viet",
  "/site/demo-hong-viet/pha-do",
  "/app/pha-do",
  "/app/thanh-vien",
  "/app/noi-dung"
];

test("primary pages have no automatically detectable WCAG A/AA violations", async ({ page }, testInfo) => {
  for (const path of paths) {
    await test.step(path, async () => {
      await page.goto(path);
      await page.locator("main").waitFor();
      const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
      await testInfo.attach(`axe-${path.replaceAll("/", "-") || "home"}`, {
        body: JSON.stringify(result.violations, null, 2),
        contentType: "application/json"
      });
      expect(result.violations, `${path} has WCAG A/AA violations`).toEqual([]);
    });
  }
});

test("keyboard focus is visible on the primary navigation", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  const outline = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
  });
  expect(outline.outlineStyle !== "none" || outline.outlineWidth !== "0px" || outline.boxShadow !== "none").toBe(true);
});
