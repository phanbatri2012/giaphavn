import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  addDemoPerson,
  changeDemoPersonLifecycle,
  createPersonalBackup,
  DemoStoreError,
  getDemoArchivedPeople,
  getDemoTree,
  linkDemoPeople,
  resetDemoData,
  restorePersonalBackup,
  updateDemoPerson
} from "@/lib/demo/store";
import {
  addPersonalContact,
  createPersonalContent,
  getPersonalSiteState,
  resetPersonalSiteData,
  updatePersonalProfile
} from "@/lib/personal/site-store";

const testDataFile = `vitest-demo-${process.pid}.json`;
const testDataPath = path.join(".data", testDataFile);
const testDatabaseFile = `vitest-personal-${process.pid}.sqlite`;
const testDatabasePath = path.join(".data", testDatabaseFile);

process.env.LOCAL_DEMO_PERSISTENCE = "true";
process.env.LOCAL_DEMO_DATA_FILE = testDataFile;
process.env.PERSONAL_DATABASE_FILE = testDatabaseFile;

describe("local demo store", () => {
  beforeEach(async () => {
    await Promise.all([resetDemoData(), resetPersonalSiteData()]);
  });

  afterAll(async () => {
    await rm(path.resolve(process.cwd(), testDataPath), { force: true });
    await rm(path.resolve(process.cwd(), testDatabasePath), { force: true });
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

    const databaseHeader = await readFile(path.resolve(process.cwd(), testDatabasePath));
    expect(databaseHeader.subarray(0, 16).toString("utf8")).toBe("SQLite format 3\u0000");
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

  test("creates and restores a validated personal backup", async () => {
    const initial = await getDemoTree();
    const backup = await createPersonalBackup();
    const added = await addDemoPerson(initial.id, {
      expectedVersion: initial.graphVersion,
      fullName: "Nguyễn Văn Sau Sao Lưu",
      gender: "male",
      relation: "child",
      anchorId: "p15",
      relationshipType: "biological"
    });
    expect((await getDemoTree()).persons.some((person) => person.id === added.id)).toBe(true);

    const restored = await restorePersonalBackup(backup);
    expect(restored.graphVersion).toBe(initial.graphVersion);
    expect(restored.persons.some((person) => person.id === added.id)).toBe(false);
  });

  test("rejects malformed personal backups without replacing data", async () => {
    const initial = await getDemoTree();
    await expect(restorePersonalBackup({ format: "unknown", version: 1 }))
      .rejects.toMatchObject({ code: "INVALID_TREE" } satisfies Partial<DemoStoreError>);
    expect((await getDemoTree()).graphVersion).toBe(initial.graphVersion);
  });

  test("persists personal content, profile and contact messages in the backup", async () => {
    const tenantId = (await getPersonalSiteState()).branding.id;
    const postId = await createPersonalContent(tenantId, {
      kind: "post",
      title: "Bài viết kiểm thử local",
      excerpt: "Nội dung được lưu trong SQLite.",
      bodyHtml: "<p>Nội dung được lưu trong SQLite.</p>",
      bodyText: "Nội dung được lưu trong SQLite.",
      category: "Tin dòng họ",
      status: "published"
    });
    await updatePersonalProfile("Người quản trị kiểm thử");
    await addPersonalContact(tenantId, {
      name: "Người gửi kiểm thử",
      contact: "kiemthu@example.vn",
      message: "Đây là lời nhắn kiểm thử đủ độ dài."
    });
    const backup = await createPersonalBackup();

    await resetPersonalSiteData();
    expect((await getPersonalSiteState()).posts.some((post) => post.id === postId)).toBe(false);
    await restorePersonalBackup(backup);
    const restored = await getPersonalSiteState();
    expect(restored.profile.fullName).toBe("Người quản trị kiểm thử");
    expect(restored.posts.some((post) => post.id === postId)).toBe(true);
    expect(restored.contacts[0]?.email).toBe("kiemthu@example.vn");
  });
});
