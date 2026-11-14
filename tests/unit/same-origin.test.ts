import { describe, expect, it } from "vitest";
import { hasTrustedOrigin } from "@/lib/security/same-origin";

describe("hasTrustedOrigin", () => {
  it("accepts same host and protocol", () => {
    const request = new Request("https://app.example.vn/api/tenants", {
      method: "POST",
      headers: { origin: "https://app.example.vn", host: "app.example.vn" }
    });
    expect(hasTrustedOrigin(request)).toBe(true);
  });

  it("honors the forwarded host used by the deployment proxy", () => {
    const request = new Request("https://internal.vercel.app/api/tenants", {
      method: "POST",
      headers: {
        origin: "https://app.example.vn",
        host: "internal.vercel.app",
        "x-forwarded-host": "app.example.vn",
        "x-forwarded-proto": "https"
      }
    });
    expect(hasTrustedOrigin(request)).toBe(true);
  });

  it("rejects a cross-site browser mutation", () => {
    const request = new Request("https://app.example.vn/api/tenants", {
      method: "POST",
      headers: { origin: "https://attacker.example", host: "app.example.vn" }
    });
    expect(hasTrustedOrigin(request)).toBe(false);
  });

  it("allows non-browser clients without an Origin header", () => {
    expect(hasTrustedOrigin(new Request("https://app.example.vn/api/health"))).toBe(true);
  });

  it("rejects cross-site browser requests even when Origin is omitted", () => {
    const request = new Request("https://app.example.vn/api/tenants", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" }
    });
    expect(hasTrustedOrigin(request)).toBe(false);
  });
});
