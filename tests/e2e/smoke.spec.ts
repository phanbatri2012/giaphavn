import { expect, test } from "@playwright/test";

test("marketing, tenant site and dashboard are reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Gìn giữ nguồn cội/i })).toBeVisible();
  await page.goto("/site/demo-hong-viet");
  await expect(page.getByRole("heading", { name: /Gia phả họ Nguyễn/i })).toBeVisible();
  await page.goto("/app/pha-do");
  await expect(page.getByRole("heading", { name: "Chỉnh sửa phả đồ" })).toBeVisible();
});

test("mobile pages do not overflow horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/site/demo-hong-viet", "/site/demo-hong-viet/pha-do", "/app/thanh-vien"]) {
    await page.goto(path);
    const horizontalScroll = await page.evaluate(() => {
      window.scrollTo(document.documentElement.scrollWidth, 0);
      return window.scrollX;
    });
    expect(horizontalScroll, `${path} allows root-level horizontal scrolling`).toBe(0);
  }
});

test("health and public graph APIs respond", async ({ request }) => {
  await expect((await request.get("/api/health")).ok()).toBe(true);
  const graph = await request.get("/api/public/trees/tree-demo-main/graph");
  expect(graph.ok()).toBe(true);
  expect((await graph.json()).persons.length).toBeGreaterThan(10);
});

test("public post, album details and Excel template are reachable", async ({ page, request }) => {
  await page.goto("/site/demo-hong-viet/tin-tuc/ngay-hoi-doan-vien-2026");
  await expect(page.getByRole("heading", { name: "Ngày hội đoàn viên — cùng kể chuyện nguồn cội" })).toBeVisible();
  await page.goto("/site/demo-hong-viet/thu-vien/album-1");
  await expect(page.getByRole("heading", { name: "Ngày đoàn viên 2026" })).toBeVisible();
  const template = await request.get("/api/trees/tree-demo-main/imports/template");
  expect(template.ok()).toBe(true);
  expect(template.headers()["content-type"]).toContain("spreadsheetml");
});

test("HTML responses use a fresh strict script nonce", async ({ request }) => {
  const first = await request.get("/");
  const second = await request.get("/");
  const firstPolicy = first.headers()["content-security-policy"] ?? "";
  const secondPolicy = second.headers()["content-security-policy"] ?? "";
  const firstScriptPolicy = firstPolicy.match(/script-src[^;]*/)?.[0] ?? "";
  const firstNonce = firstScriptPolicy.match(/'nonce-([^']+)'/)?.[1];
  const secondNonce = secondPolicy.match(/script-src[^;]*'nonce-([^']+)'/)?.[1];
  expect(firstNonce).toBeTruthy();
  expect(secondNonce).toBeTruthy();
  expect(firstNonce).not.toBe(secondNonce);
  expect(firstScriptPolicy).toContain("'strict-dynamic'");
  expect(firstScriptPolicy).not.toContain("'unsafe-inline'");
});

test("homepage does not enter a development reload loop", async ({ page }) => {
  let mainFrameNavigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) mainFrameNavigations += 1;
  });
  await page.goto("/");
  await page.waitForTimeout(3_000);
  // The first development compilation may cause one Fast Refresh. More than
  // one additional navigation indicates an HMR hash-mismatch reload loop.
  expect(mainFrameNavigations).toBeLessThanOrEqual(2);
});

test("bundled fonts load Vietnamese glyphs", async ({ page }) => {
  await page.goto("/");
  const fontState = await page.evaluate(async () => {
    await document.fonts.ready;
    const heading = document.querySelector(".hero-copy h1");
    return {
      serifLoaded: document.fonts.check('700 64px "Noto Serif Variable"', "Gìn giữ nguồn cội — Kể tổ tiên mãi sau"),
      sansLoaded: document.fonts.check('400 16px "Noto Sans Variable"', "Tiếng Việt: ă â ê ô ơ ư đ ạ ả ã"),
      headingFamily: heading ? getComputedStyle(heading).fontFamily : ""
    };
  });
  expect(fontState.serifLoaded).toBe(true);
  expect(fontState.sansLoaded).toBe(true);
  expect(fontState.headingFamily).toContain("Noto Serif Variable");
});
