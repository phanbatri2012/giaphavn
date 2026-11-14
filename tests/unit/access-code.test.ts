import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { hashTreeAccessCode, verifyTreeAccessCode, verifyTreeAccessCookie } from "@/lib/security/access-code";

describe("protected tree access", () => {
  const previous = process.env.TREE_ACCESS_COOKIE_SECRET;
  afterEach(() => { process.env.TREE_ACCESS_COOKIE_SECRET = previous; });

  it("stores and checks an Argon2id hash", async () => {
    const hashed = await hashTreeAccessCode("ma-gia-pha-2026");
    expect(hashed).not.toContain("ma-gia-pha-2026");
    expect(await verifyTreeAccessCode(hashed, "ma-gia-pha-2026")).toBe(true);
    expect(await verifyTreeAccessCode(hashed, "sai-ma")).toBe(false);
  });

  it("accepts only an unexpired signed cookie", () => {
    process.env.TREE_ACCESS_COOKIE_SECRET = "a-secret-key-that-is-longer-than-32-characters";
    const treeId = "tree-123";
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const signature = createHmac("sha256", process.env.TREE_ACCESS_COOKIE_SECRET).update(`${treeId}.${expires}`).digest("hex");
    expect(verifyTreeAccessCookie(treeId, `${expires}.${signature}`)).toBe(true);
    expect(verifyTreeAccessCookie("other-tree", `${expires}.${signature}`)).toBe(false);
  });
});

