import { describe, expect, it } from "vitest";
import { checkPersonLimit, findCycle, normalizeVietnameseName, toPublicPerson, validateTree } from "@/lib/domain/genealogy";
import { demoTree } from "@/lib/demo/data";
import { PLANS } from "@/lib/domain/plans";

describe("genealogy rules", () => {
  it("normalizes Vietnamese names for accent-insensitive search", () => {
    expect(normalizeVietnameseName("  Nguyễn Đình Ánh  ")).toBe("nguyen dinh anh");
  });

  it("detects a parentage cycle", () => {
    const links = [
      { id: "1", tenantId: "t", treeId: "g", parentId: "a", childId: "b", relationshipType: "biological" as const, sortOrder: 0 },
      { id: "2", tenantId: "t", treeId: "g", parentId: "b", childId: "c", relationshipType: "biological" as const, sortOrder: 0 },
      { id: "3", tenantId: "t", treeId: "g", parentId: "c", childId: "a", relationshipType: "biological" as const, sortOrder: 0 }
    ];
    expect(findCycle(["a", "b", "c"], links)).toEqual(["a", "b", "c", "a"]);
  });

  it("accepts the seeded multi-union demo tree", () => {
    const multiUnionTree = { ...demoTree, unions: [...demoTree.unions, { id: "u6", tenantId: demoTree.tenantId, treeId: demoTree.id, partnerIds: ["p7", "p13"], sortOrder: 2 }] };
    expect(validateTree(multiUnionTree)).toEqual([]);
    expect(multiUnionTree.unions.filter((union) => union.partnerIds.includes("p7"))).toHaveLength(2);
  });

  it("hides sensitive living-person fields in the public projection", () => {
    const living = { ...demoTree.persons.find((person) => !person.isDeceased)!, phone: "0900000000", email: "private@example.vn", address: "Nhà riêng", biography: "Riêng tư", publicFields: { avatar: true, exactBirthDate: false, phone: false, email: false, address: false, biography: false } };
    const result = toPublicPerson(living);
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("address");
    expect(result).not.toHaveProperty("biography");
    expect(result).not.toHaveProperty("birthDate");
  });

  it("keeps deceased-person private fields hidden unless explicitly published", () => {
    const deceased = {
      ...demoTree.persons.find((person) => person.isDeceased)!,
      phone: "0900000000",
      email: "private@example.vn",
      address: "Nhà riêng",
      biography: "Riêng tư",
      publicFields: { avatar: false, exactBirthDate: false, phone: false, email: false, address: false, biography: false }
    };
    const result = toPublicPerson(deceased);
    expect(result).not.toHaveProperty("avatarUrl");
    expect(result).not.toHaveProperty("birthDate");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("address");
    expect(result).not.toHaveProperty("biography");
    expect(result).toHaveProperty("deathDate");
  });

  it("enforces limits from plan data", () => {
    const free = PLANS.find((plan) => plan.id === "free")!;
    expect(checkPersonLimit(free, 49)).toEqual({ allowed: true, remaining: 1, limit: 50 });
    expect(checkPersonLimit(free, 50).allowed).toBe(false);
  });
});
