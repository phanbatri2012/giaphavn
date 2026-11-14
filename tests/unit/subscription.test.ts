import { describe, expect, it } from "vitest";
import { nextSubscriptionPeriod } from "@/lib/domain/genealogy";

describe("subscription periods", () => {
  const paidAt = new Date("2026-11-11T00:00:00.000Z");

  it("starts a purchase and upgrade from payment time", () => {
    const purchase = nextSubscriptionPeriod({ planId: "free", status: "free" }, paidAt, "purchase");
    const upgrade = nextSubscriptionPeriod({ planId: "basic", status: "active", expiresAt: "2027-06-01T00:00:00.000Z" }, paidAt, "upgrade");
    expect(purchase.expiresAt).toBe("2027-11-11T00:00:00.000Z");
    expect(upgrade.expiresAt).toBe("2027-11-11T00:00:00.000Z");
  });

  it("adds renewal after the later current expiry", () => {
    const result = nextSubscriptionPeriod({ planId: "community", status: "active", expiresAt: "2027-06-01T00:00:00.000Z" }, paidAt, "renew");
    expect(result.expiresAt).toBe("2028-05-31T00:00:00.000Z");
  });
});

