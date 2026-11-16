import { expect, test } from "@playwright/test";

test("personal family site and dashboard are reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Gia phả họ Nguyễn/i })).toBeVisible();
  await page.goto("/pha-do");
  await expect(page.getByRole("heading", { name: "Phả đồ dòng họ" })).toBeVisible();
  await page.goto("/admin/pha-do");
  await expect(page.getByRole("heading", { name: "Chỉnh sửa phả đồ" })).toBeVisible();
});

test("mobile pages do not overflow horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/pha-do", "/admin/thanh-vien"]) {
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
  await page.goto("/tin-tuc/ngay-hoi-doan-vien-2026");
  await expect(page.getByRole("heading", { name: "Ngày hội đoàn viên — cùng kể chuyện nguồn cội" })).toBeVisible();
  await page.goto("/thu-vien/album-1");
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
    const heading = document.querySelector(".tenant-hero h1");
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

test("local demo genealogy edits survive a page reload", async ({ page, request }) => {
  const reset = await request.post("/api/demo/reset");
  expect(reset.ok()).toBe(true);

  try {
    await page.goto("/admin/pha-do");
    await page.getByRole("button", { name: "Thêm người" }).click();
    await page.getByLabel("Họ và tên").fill("Nguyễn Thị Kiểm Thử E2E");
    await page.getByLabel("Giới tính").selectOption("female");
    const [addResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/trees/tree-demo-main/persons") && response.request().method() === "POST"),
      page.getByRole("button", { name: "Thêm vào phả đồ" }).click()
    ]);
    expect(addResponse.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Nguyễn Thị Kiểm Thử E2E" })).toBeVisible();

    await page.getByRole("button", { name: /Sửa hồ sơ/ }).click();
    const editor = page.locator(".person-editor-dialog");
    await editor.getByLabel("Họ và tên").fill("Nguyễn Thị Minh Anh E2E");
    await editor.getByLabel("Vai vế").fill("Hậu duệ kiểm thử");
    const [updateResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/trees/tree-demo-main/persons/") && response.request().method() === "PATCH"),
      editor.getByRole("button", { name: "Lưu hồ sơ" }).click()
    ]);
    expect(updateResponse.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: "Nguyễn Thị Minh Anh E2E" })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Nguyễn Thị Minh Anh E2E", { exact: true }).first()).toBeVisible();
    const graph = await request.get("/api/public/trees/tree-demo-main/graph");
    const payload = await graph.json() as { persons: Array<{ fullName: string }> };
    expect(payload.persons.some((person) => person.fullName === "Nguyễn Thị Minh Anh E2E")).toBe(true);
  } finally {
    await request.post("/api/demo/reset");
  }
});

test("legacy SaaS URLs redirect to Personal Edition routes", async ({ page }) => {
  await page.goto("/site/demo-hong-viet/pha-do");
  await expect(page).toHaveURL(/\/pha-do$/);
  await page.goto("/app/thanh-vien");
  await expect(page).toHaveURL(/\/admin\/thanh-vien$/);
  await page.goto("/bang-gia");
  await expect(page).toHaveURL(/\/admin$/);
});

test("personal content, contacts, backups and local images persist", async ({ page, request }) => {
  const reset = await request.post("/api/demo/reset");
  expect(reset.ok()).toBe(true);
  try {
    const post = await request.post("/api/tenants/tenant-demo-hong-viet/content", {
      data: {
        kind: "post",
        title: "Tin mới từ SQLite cá nhân",
        excerpt: "Bài viết kiểm thử lưu local.",
        bodyHtml: "<p>Bài viết kiểm thử lưu local.</p>",
        category: "Tin dòng họ",
        status: "published"
      }
    });
    expect(post.status()).toBe(201);

    const contact = await request.post("/api/public/contact", {
      data: {
        tenantId: "tenant-demo-hong-viet",
        name: "Người gửi E2E",
        contact: "e2e@example.vn",
        message: "Lời nhắn kiểm thử cho kho dữ liệu cá nhân.",
        website: ""
      }
    });
    expect(contact.status()).toBe(201);

    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const upload = await request.post("/api/personal/media", {
      multipart: {
        tenantId: "tenant-demo-hong-viet",
        albumId: "album-1",
        alt: "Ảnh kiểm thử",
        isPublic: "true",
        file: { name: "kiem-thu.png", mimeType: "image/png", buffer: png }
      }
    });
    expect(upload.status()).toBe(201);
    const uploaded = await upload.json() as { id: string; publicUrl: string };
    expect((await request.get(uploaded.publicUrl)).headers()["content-type"]).toContain("image/png");

    await page.goto("/tin-tuc");
    await expect(page.getByText("Tin mới từ SQLite cá nhân", { exact: true })).toBeVisible();
    await page.goto("/admin/noi-dung");
    await expect(page.getByText("Người gửi E2E", { exact: true })).toBeVisible();

    const backup = await request.get("/api/personal/backup");
    expect(backup.ok()).toBe(true);
    const backupData = await backup.json() as { format: string; site?: { posts: Array<{ title: string }> } };
    expect(backupData.format).toBe("giaphavn-personal-backup");
    expect(backupData.site?.posts.some((item) => item.title === "Tin mới từ SQLite cá nhân")).toBe(true);

    expect((await request.delete(`/api/personal/media/${uploaded.id}`)).ok()).toBe(true);
  } finally {
    await request.post("/api/demo/reset");
  }
});

test("protected personal tree stays locked until the correct code is entered", async ({ page }) => {
  expect((await page.request.post("/api/demo/reset")).ok()).toBe(true);
  try {
    const update = await page.request.patch("/api/trees/tree-demo-main", {
      data: {
        expectedVersion: 12,
        name: "Phả đồ họ Nguyễn — Chi Đà Nẵng",
        rootPersonId: "p1",
        visibility: "protected",
        accessCode: "mat-ma-kiem-thu"
      }
    });
    expect(update.ok()).toBe(true);
    expect((await page.request.get("/api/public/trees/tree-demo-main/graph")).status()).toBe(401);

    await page.goto("/pha-do");
    await expect(page.getByText("Phả đồ được bảo vệ", { exact: true })).toBeVisible();
    await page.getByLabel("Mã bảo mật").fill("mat-ma-kiem-thu");
    await page.getByRole("button", { name: "Mở phả đồ" }).click();
    await expect(page.getByRole("heading", { name: "Nguyễn Văn Khải" })).toBeVisible();
    expect((await page.request.get("/api/public/trees/tree-demo-main/graph")).ok()).toBe(true);
  } finally {
    await page.request.post("/api/demo/reset");
  }
});
