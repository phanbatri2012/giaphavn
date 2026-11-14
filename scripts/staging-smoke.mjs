const baseUrlValue = process.env.STAGING_BASE_URL;

if (!baseUrlValue) {
  console.error("Thiếu STAGING_BASE_URL, ví dụ: https://staging.example.vn");
  process.exit(2);
}

const baseUrl = new URL(baseUrlValue);
if (baseUrl.protocol !== "https:" && process.env.STAGING_ALLOW_HTTP !== "true") {
  console.error("STAGING_BASE_URL phải dùng HTTPS. Chỉ đặt STAGING_ALLOW_HTTP=true cho môi trường cục bộ.");
  process.exit(2);
}

const results = [];

async function check(name, assertion) {
  try {
    const detail = await assertion();
    results.push({ name, status: "PASS", detail });
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, status: "FAIL", detail });
    console.error(`FAIL  ${name} — ${detail}`);
  }
}

async function request(pathOrUrl, init) {
  const url = new URL(pathOrUrl, baseUrl);
  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000)
  });
  return { response, url };
}

function requireStatus(response, expected, label) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.includes(response.status)) {
    throw new Error(`${label}: HTTP ${response.status}, cần ${accepted.join(" hoặc ")}`);
  }
}

function nonceFrom(response) {
  const policy = response.headers.get("content-security-policy") ?? "";
  const scriptPolicy = policy.match(/script-src[^;]*/)?.[0] ?? "";
  const nonce = scriptPolicy.match(/'nonce-([^']+)'/)?.[1];
  if (!nonce) throw new Error("CSP không có script nonce");
  if (!scriptPolicy.includes("'strict-dynamic'")) throw new Error("script-src thiếu strict-dynamic");
  if (scriptPolicy.includes("'unsafe-inline'")) throw new Error("script-src còn unsafe-inline");
  return nonce;
}

await check("health endpoint", async () => {
  const { response } = await request("/api/health");
  requireStatus(response, 200, "health");
  const body = await response.json();
  if (body.status !== "ok" || body.service !== "giaphavn") throw new Error("payload health không hợp lệ");
  if (process.env.STAGING_REQUIRE_SUPABASE === "true" && body.mode !== "supabase") {
    throw new Error(`health đang ở mode ${body.mode}, cần supabase`);
  }
  return `mode=${body.mode}`;
});

let firstNonce;
await check("marketing HTML và CSP", async () => {
  const { response } = await request("/");
  requireStatus(response, 200, "trang chủ");
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) throw new Error("trang chủ không trả HTML");
  firstNonce = nonceFrom(response);
  if (process.env.STAGING_REQUIRE_HSTS === "true" && !response.headers.has("strict-transport-security")) {
    throw new Error("thiếu Strict-Transport-Security");
  }
  return "nonce + strict-dynamic hợp lệ";
});

await check("CSP dùng nonce mới cho mỗi request", async () => {
  const { response } = await request("/");
  requireStatus(response, 200, "trang chủ lần hai");
  const secondNonce = nonceFrom(response);
  if (firstNonce === secondNonce) throw new Error("hai response dùng cùng nonce");
  return "nonce không bị tái sử dụng";
});

await check("robots.txt", async () => {
  const { response } = await request("/robots.txt");
  requireStatus(response, 200, "robots.txt");
  const body = await response.text();
  if (!/User-Agent:/i.test(body) || !/Sitemap:/i.test(body)) throw new Error("robots.txt thiếu User-Agent hoặc Sitemap");
  return "có sitemap";
});

await check("sitemap.xml", async () => {
  const { response } = await request("/sitemap.xml");
  requireStatus(response, 200, "sitemap.xml");
  const body = await response.text();
  if (!body.includes("<urlset") || !body.includes("<loc>")) throw new Error("sitemap không có URL");
  return "XML có URL";
});

if (process.env.STAGING_TENANT_URL) {
  await check("website tenant công khai", async () => {
    const response = await fetch(new URL(process.env.STAGING_TENANT_URL), {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000)
    });
    requireStatus(response, 200, "tenant homepage");
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) throw new Error("tenant homepage không trả HTML");
    nonceFrom(response);
    return new URL(process.env.STAGING_TENANT_URL).hostname;
  });
}

if (process.env.STAGING_PUBLIC_TREE_ID) {
  await check("public tree projection", async () => {
    const treeId = encodeURIComponent(process.env.STAGING_PUBLIC_TREE_ID);
    const { response } = await request(`/api/public/trees/${treeId}/graph`);
    requireStatus(response, 200, "public tree graph");
    const body = await response.json();
    if (!Array.isArray(body.persons) || !Array.isArray(body.parentageLinks)) throw new Error("payload graph thiếu persons/parentageLinks");
    return `${body.persons.length} người`;
  });
}

if (process.env.STAGING_EXPECT_REGISTRATION_CLOSED === "true") {
  await check("public registration đang đóng", async () => {
    const { response } = await request("/api/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Staging Smoke", slug: "staging-smoke", rootPersonName: "Nguyễn Văn Gốc", rootPersonGender: "male" })
    });
    requireStatus(response, 403, "registration flag");
    return "API từ chối với HTTP 403";
  });
}

if (process.env.STAGING_EXPECT_PAYMENTS_CLOSED === "true") {
  await check("payments đang đóng", async () => {
    const { response } = await request("/api/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "00000000-0000-4000-8000-000000000001", planId: "basic", kind: "purchase" })
    });
    requireStatus(response, 503, "payments flag");
    return "API từ chối với HTTP 503";
  });
}

const failures = results.filter((result) => result.status === "FAIL");
console.log(`\nKết quả staging smoke: ${results.length - failures.length}/${results.length} kiểm tra đạt.`);
if (failures.length) process.exitCode = 1;
