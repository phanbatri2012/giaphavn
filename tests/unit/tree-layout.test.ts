import { describe, expect, it } from "vitest";
import { computeTreeLayout, initialTreeGenerationLimit } from "@/lib/domain/tree-layout";
import type { FamilyTree, Person } from "@/lib/domain/types";

function createLargeTree(size = 500): FamilyTree {
  const persons: Person[] = [];
  const parentageLinks: FamilyTree["parentageLinks"] = [];
  for (let index = 0; index < size; index += 1) {
    const parentIndex = index === 0 ? undefined : Math.floor((index - 1) / 3);
    const generation = parentIndex === undefined ? 1 : persons[parentIndex].generation + 1;
    persons.push({
      id: `person-${index}`,
      tenantId: "tenant-performance",
      treeId: "tree-performance",
      fullName: `Thành viên ${index}`,
      searchName: `thanh vien ${index}`,
      gender: index % 2 ? "female" : "male",
      generation,
      isDeceased: false,
      publicFields: { avatar: false, exactBirthDate: false, phone: false, email: false, address: false, biography: false },
      sortOrder: index
    });
    if (parentIndex !== undefined) {
      parentageLinks.push({
        id: `link-${index}`,
        tenantId: "tenant-performance",
        treeId: "tree-performance",
        parentId: `person-${parentIndex}`,
        childId: `person-${index}`,
        relationshipType: "biological",
        sortOrder: index
      });
    }
  }
  return {
    id: "tree-performance",
    tenantId: "tenant-performance",
    name: "Phả đồ kiểm thử 500 người",
    rootPersonId: "person-0",
    visibility: "public",
    graphVersion: 1,
    persons,
    unions: [],
    parentageLinks
  };
}

describe("large genealogy layout", () => {
  it("lays out 500 people within the desktop two-second target", async () => {
    const tree = createLargeTree();
    const startedAt = performance.now();
    const layout = await computeTreeLayout(tree);
    const elapsed = performance.now() - startedAt;
    expect(layout.nodes).toHaveLength(500);
    expect(layout.edges).toHaveLength(499);
    expect(elapsed).toBeLessThan(2_000);
  }, 10_000);

  it("defaults large trees to the first five generations", () => {
    const tree = createLargeTree();
    const limit = initialTreeGenerationLimit(tree);
    expect(limit).toBe(5);
    expect(tree.persons.filter((person) => person.generation <= limit).length).toBeLessThanOrEqual(200);
  });
});
