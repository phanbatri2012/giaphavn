import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  addDemoPerson,
  changeDemoPersonLifecycle,
  DemoStoreError,
  getDemoArchivedPeople,
  getDemoTree,
  linkDemoPeople,
  resetDemoData,
  updateDemoPerson
} from "@/lib/demo/store";

const testDataFile = `vitest-demo-${process.pid}.json`;
const testDataPath = path.join(".data", testDataFile);

process.env.LOCAL_DEMO_PERSISTENCE = "true";
process.env.LOCAL_DEMO_DATA_FILE = testDataFile;

describe("local demo store", () => {
  beforeEach(async () => {
    await resetDemoData();
  });

  afterAll(async () => {
    await rm(path.resolve(process.cwd(), testDataPath), { force: true });
  });

  test("persists a new person and a full profile update", async () => {
    const initial = await getDemoTree();
    const added = await addDemoPerson(initial.id, {
      expectedVersion: initial.graphVersion,
      fullName: "Nguyễn Thị Kiểm Thử",
      gender: "female",
      relation: "child",
      anchorId: "p15",
      relationshipType: "biological"
    });

    const afterAdd = await getDemoTree();
    expect(afterAdd.graphVersion).toBe(initial.graphVersion + 1);
    expect(afterAdd.persons.find((person) => person.id === added.id)?.fullName).toBe("Nguyễn Thị Kiểm Thử");

    await updateDemoPerson(initial.id, added.id, {
      expectedVersion: added.graphVersion,
      fullName: "Nguyễn Thị Minh Anh",
      otherName: "Bé An",
      gender: "female",
      roleTitle: "Hậu duệ",
      avatarUrl: "",
      generation: 5,
      biography: "Hồ sơ dùng để kiểm thử dữ liệu local.",
      birthDate: { value: "2001", precision: "year", calendar: "solar" },
      deathDate: undefined,
      isDeceased: false,
      address: "Đà Nẵng",
      education: "Đại học",
      religion: "",
      phone: "",
      email: "",
      publicFields: {
        avatar: true,
        exactBirthDate: false,
        phone: false,
        email: false,
        address: false,
        biography: true
      }
    });

    const reloaded = await getDemoTree();
    expect(reloaded.persons.find((person) => person.id === added.id)).toMatchObject({
      fullName: "Nguyễn Thị Minh Anh",
      searchName: "nguyen thi minh anh",
      otherName: "Bé An",
      roleTitle: "Hậu duệ"
    });
  });

  test("rejects stale versions and genealogy cycles", async () => {
    const initial = await getDemoTree();
    await addDemoPerson(initial.id, {
      expectedVersion: initial.graphVersion,
      fullName: "Nguyễn Văn Phiên Bản",
      gender: "male",
      relation: "child",
      anchorId: "p15",
      relationshipType: "biological"
    });

    await expect(addDemoPerson(initial.id, {
      expectedVersion: initial.graphVersion,
      fullName: "Nguyễn Văn Trễ",
      gender: "male",
      relation: "child",
      anchorId: "p15",
      relationshipType: "biological"
    })).rejects.toMatchObject({ code: "VERSION_CONFLICT" } satisfies Partial<DemoStoreError>);

    const current = await getDemoTree();
    await expect(linkDemoPeople(initial.id, {
      expectedVersion: current.graphVersion,
      parentId: "p15",
      childId: "p1",
      relationshipType: "biological"
    })).rejects.toMatchObject({ code: "GENEALOGY_CYCLE" } satisfies Partial<DemoStoreError>);
  });

  test("archives and restores a leaf without losing its relationships", async () => {
    const initial = await getDemoTree();
    const relationshipCount = initial.parentageLinks.filter((link) => link.childId === "p16").length;
    const archived = await changeDemoPersonLifecycle(initial.id, "p16", initial.graphVersion, "archive");

    expect((await getDemoTree()).persons.some((person) => person.id === "p16")).toBe(false);
    expect((await getDemoArchivedPeople(initial.id)).map((person) => person.id)).toContain("p16");

    await changeDemoPersonLifecycle(initial.id, "p16", archived.graphVersion, "restore");
    const restored = await getDemoTree();
    expect(restored.persons.some((person) => person.id === "p16")).toBe(true);
    expect(restored.parentageLinks.filter((link) => link.childId === "p16")).toHaveLength(relationshipCount);
  });
});
