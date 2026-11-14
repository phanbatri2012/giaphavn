import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { demoTree } from "@/lib/demo/data";
import { normalizeVietnameseName, validateTree } from "@/lib/domain/genealogy";
import type {
  FamilyTree,
  FamilyUnion,
  GenealogyDate,
  ParentageLink,
  Person,
  PersonGender,
  PersonPublicFields,
  RelationshipType,
  TreeVisibility
} from "@/lib/domain/types";

type DemoState = {
  schemaVersion: 1;
  tree: FamilyTree;
};

type DemoStoreGlobals = typeof globalThis & {
  __giaphavnDemoQueue?: Promise<void>;
};

type AddPersonInput = {
  expectedVersion: number;
  fullName: string;
  gender: PersonGender;
  relation: "parent" | "spouse" | "child";
  anchorId: string;
  relationshipType: RelationshipType;
};

export type UpdatePersonInput = {
  expectedVersion: number;
  fullName: string;
  otherName: string;
  gender: PersonGender;
  roleTitle: string;
  avatarUrl: string;
  generation: number;
  biography: string;
  birthDate?: GenealogyDate;
  deathDate?: GenealogyDate;
  isDeceased: boolean;
  address: string;
  education: string;
  religion: string;
  phone: string;
  email: string;
  publicFields: PersonPublicFields;
};

export class DemoStoreError extends Error {
  constructor(
    public readonly code:
      | "DEMO_READ_ONLY"
      | "VERSION_CONFLICT"
      | "NOT_FOUND"
      | "MEMBER_LIMIT"
      | "INVALID_RELATION"
      | "GENEALOGY_CYCLE"
      | "ROOT_PERSON"
      | "PERSON_HAS_CHILDREN"
      | "INVALID_TREE",
    message: string,
    public readonly status: number,
    public readonly currentVersion?: number
  ) {
    super(message);
    this.name = "DemoStoreError";
  }
}

export function isLocalDemoPersistenceEnabled() {
  return process.env.LOCAL_DEMO_PERSISTENCE === "true";
}

function dataFilePath() {
  const filename = process.env.LOCAL_DEMO_DATA_FILE?.trim() || "demo-state.json";
  if (!/^[a-zA-Z0-9._-]+\.json$/.test(filename)) {
    throw new Error("LOCAL_DEMO_DATA_FILE phải là một tên file .json hợp lệ.");
  }
  return path.join(process.cwd(), ".data", filename);
}

function cloneSeedTree() {
  return structuredClone(demoTree);
}

function projectActiveTree(tree: FamilyTree): FamilyTree {
  const persons = tree.persons.filter((person) => !person.archivedAt);
  const activeIds = new Set(persons.map((person) => person.id));
  const unions = tree.unions.filter(
    (union) => union.partnerIds.length > 0 && union.partnerIds.every((id) => activeIds.has(id))
  );
  const unionIds = new Set(unions.map((union) => union.id));
  const parentageLinks = tree.parentageLinks.filter(
    (link) =>
      activeIds.has(link.parentId) &&
      activeIds.has(link.childId) &&
      (!link.unionId || unionIds.has(link.unionId))
  );
  return { ...tree, persons, unions, parentageLinks };
}

function looksLikeState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<DemoState>;
  return (
    state.schemaVersion === 1 &&
    Boolean(state.tree) &&
    state.tree?.id === demoTree.id &&
    Array.isArray(state.tree?.persons) &&
    Array.isArray(state.tree?.unions) &&
    Array.isArray(state.tree?.parentageLinks)
  );
}

async function writeState(tree: FamilyTree) {
  const filename = dataFilePath();
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ schemaVersion: 1, tree } satisfies DemoState, null, 2)}\n`, "utf8");
  await rename(temporary, filename);
}

async function readState() {
  const filename = dataFilePath();
  try {
    const parsed: unknown = JSON.parse(await readFile(filename, "utf8"));
    if (!looksLikeState(parsed)) throw new Error("Định dạng kho dữ liệu demo không hợp lệ.");
    return structuredClone(parsed.tree);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const tree = cloneSeedTree();
    await writeState(tree);
    return tree;
  }
}

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const globals = globalThis as DemoStoreGlobals;
  const previous = globals.__giaphavnDemoQueue ?? Promise.resolve();
  const running = previous.catch(() => undefined).then(task);
  globals.__giaphavnDemoQueue = running.then(() => undefined, () => undefined);
  return running;
}

async function requireWritableTree(treeId: string) {
  if (!isLocalDemoPersistenceEnabled()) {
    throw new DemoStoreError(
      "DEMO_READ_ONLY",
      "Chế độ lưu demo local chưa được bật.",
      503
    );
  }
  const tree = await readState();
  if (tree.id !== treeId) throw new DemoStoreError("NOT_FOUND", "Không tìm thấy phả đồ.", 404);
  return tree;
}

function requireCurrentVersion(tree: FamilyTree, expectedVersion: number) {
  if (tree.graphVersion !== expectedVersion) {
    throw new DemoStoreError(
      "VERSION_CONFLICT",
      "Phả đồ đã thay đổi. Hãy tải lại trang.",
      409,
      tree.graphVersion
    );
  }
}

function activePerson(tree: FamilyTree, personId: string) {
  const person = tree.persons.find((item) => item.id === personId && !item.archivedAt);
  if (!person) throw new DemoStoreError("NOT_FOUND", "Không tìm thấy thành viên.", 404);
  return person;
}

function validateMutation(tree: FamilyTree) {
  const errors = validateTree(projectActiveTree(tree));
  if (!errors.length) return;
  const cycle = errors.find((error) => error.includes("chu trình"));
  if (cycle) throw new DemoStoreError("GENEALOGY_CYCLE", "Quan hệ này sẽ tạo chu trình trong phả đồ.", 409);
  throw new DemoStoreError("INVALID_TREE", errors[0], 409);
}

async function mutateTree<T>(
  treeId: string,
  expectedVersion: number,
  mutation: (tree: FamilyTree) => T
): Promise<T & { graphVersion: number }> {
  return runExclusive(async () => {
    const tree = await requireWritableTree(treeId);
    requireCurrentVersion(tree, expectedVersion);
    const result = mutation(tree);
    validateMutation(tree);
    tree.graphVersion += 1;
    await writeState(tree);
    return { ...result, graphVersion: tree.graphVersion };
  });
}

export async function getDemoTree(options: { includeArchived?: boolean } = {}) {
  if (!isLocalDemoPersistenceEnabled()) return cloneSeedTree();
  return runExclusive(async () => {
    const tree = await readState();
    return options.includeArchived ? tree : projectActiveTree(tree);
  });
}

export async function getDemoArchivedPeople(treeId: string) {
  const tree = await getDemoTree({ includeArchived: true });
  if (tree.id !== treeId) return [];
  return tree.persons
    .filter((person) => Boolean(person.archivedAt))
    .sort((left, right) => String(right.archivedAt).localeCompare(String(left.archivedAt)));
}

export async function resetDemoData() {
  if (!isLocalDemoPersistenceEnabled()) {
    throw new DemoStoreError("DEMO_READ_ONLY", "Chế độ lưu demo local chưa được bật.", 503);
  }
  return runExclusive(async () => {
    const tree = cloneSeedTree();
    await writeState(tree);
    return projectActiveTree(tree);
  });
}

export async function addDemoPerson(treeId: string, input: AddPersonInput) {
  return mutateTree(treeId, input.expectedVersion, (tree) => {
    if (tree.persons.filter((person) => !person.archivedAt).length >= 500) {
      throw new DemoStoreError("MEMBER_LIMIT", "Phả đồ demo đã đạt giới hạn 500 thành viên.", 409);
    }
    const anchor = activePerson(tree, input.anchorId);
    let rebased = false;
    let generation = input.relation === "child" ? anchor.generation + 1 : anchor.generation;
    if (input.relation === "parent") {
      if (anchor.generation === 1) {
        if (tree.persons.some((person) => person.generation >= 99)) {
          throw new DemoStoreError("INVALID_RELATION", "Không thể tăng thêm số đời cho phả đồ này.", 409);
        }
        tree.persons.forEach((person) => { person.generation += 1; });
        rebased = true;
        generation = 1;
      } else {
        generation = anchor.generation - 1;
      }
    }
    if (generation > 99) {
      throw new DemoStoreError("INVALID_RELATION", "Số đời của thành viên vượt giới hạn.", 409);
    }

    const id = crypto.randomUUID();
    const person: Person = {
      id,
      tenantId: tree.tenantId,
      treeId: tree.id,
      fullName: input.fullName,
      searchName: normalizeVietnameseName(input.fullName),
      gender: input.gender,
      generation,
      isDeceased: false,
      publicFields: {
        avatar: true,
        exactBirthDate: false,
        phone: false,
        email: false,
        address: false,
        biography: false
      },
      sortOrder: Math.max(0, ...tree.persons.map((item) => item.sortOrder)) + 1
    };
    tree.persons.push(person);

    let unionId: string | undefined;
    if (input.relation === "spouse") {
      unionId = crypto.randomUUID();
      tree.unions.push({
        id: unionId,
        tenantId: tree.tenantId,
        treeId: tree.id,
        partnerIds: [anchor.id, id],
        sortOrder: Math.max(0, ...tree.unions.map((union) => union.sortOrder)) + 1
      });
    } else {
      tree.parentageLinks.push({
        id: crypto.randomUUID(),
        tenantId: tree.tenantId,
        treeId: tree.id,
        parentId: input.relation === "parent" ? id : anchor.id,
        childId: input.relation === "parent" ? anchor.id : id,
        relationshipType: input.relationshipType,
        sortOrder: Math.max(0, ...tree.parentageLinks.map((link) => link.sortOrder)) + 1
      });
    }
    return { id, unionId, generation, rebased };
  });
}

export async function updateDemoPerson(
  treeId: string,
  personId: string,
  input: UpdatePersonInput
) {
  return mutateTree(treeId, input.expectedVersion, (tree) => {
    const person = activePerson(tree, personId);
    Object.assign(person, {
      fullName: input.fullName,
      searchName: normalizeVietnameseName(input.fullName),
      otherName: input.otherName || undefined,
      gender: input.gender,
      roleTitle: input.roleTitle || undefined,
      avatarUrl: input.avatarUrl || undefined,
      generation: input.generation,
      biography: input.biography || undefined,
      birthDate: input.birthDate,
      deathDate: input.deathDate,
      isDeceased: input.isDeceased,
      address: input.address || undefined,
      education: input.education || undefined,
      religion: input.religion || undefined,
      phone: input.phone || undefined,
      email: input.email || undefined,
      publicFields: input.publicFields
    });
    return { updated: true };
  });
}

export async function changeDemoPersonLifecycle(
  treeId: string,
  personId: string,
  expectedVersion: number,
  action: "archive" | "restore"
) {
  return mutateTree(treeId, expectedVersion, (tree) => {
    const person = tree.persons.find((item) => item.id === personId);
    if (!person) throw new DemoStoreError("NOT_FOUND", "Không tìm thấy thành viên.", 404);
    if (action === "archive") {
      if (person.archivedAt) throw new DemoStoreError("NOT_FOUND", "Thành viên đã được lưu trữ.", 404);
      if (person.id === tree.rootPersonId) {
        throw new DemoStoreError("ROOT_PERSON", "Hãy chọn người gốc khác trước khi lưu trữ.", 409);
      }
      const hasChildren = tree.parentageLinks.some(
        (link) => link.parentId === person.id && tree.persons.some((item) => item.id === link.childId && !item.archivedAt)
      );
      if (hasChildren) {
        throw new DemoStoreError(
          "PERSON_HAS_CHILDREN",
          "Hãy chuyển hoặc gỡ quan hệ con trước khi lưu trữ.",
          409
        );
      }
      person.archivedAt = new Date().toISOString();
      return { archived: true };
    }
    if (!person.archivedAt) throw new DemoStoreError("NOT_FOUND", "Thành viên chưa được lưu trữ.", 404);
    person.archivedAt = undefined;
    return { restored: true };
  });
}

export async function linkDemoPeople(
  treeId: string,
  input: {
    expectedVersion: number;
    parentId: string;
    childId: string;
    relationshipType: RelationshipType;
  }
) {
  return mutateTree(treeId, input.expectedVersion, (tree) => {
    activePerson(tree, input.parentId);
    activePerson(tree, input.childId);
    if (input.parentId === input.childId) {
      throw new DemoStoreError("INVALID_RELATION", "Một người không thể là cha/mẹ của chính mình.", 400);
    }
    const existing = tree.parentageLinks.find(
      (link) => link.parentId === input.parentId && link.childId === input.childId
    );
    if (existing) {
      existing.relationshipType = input.relationshipType;
      return { id: existing.id };
    }
    const link: ParentageLink = {
      id: crypto.randomUUID(),
      tenantId: tree.tenantId,
      treeId: tree.id,
      parentId: input.parentId,
      childId: input.childId,
      relationshipType: input.relationshipType,
      sortOrder: Math.max(0, ...tree.parentageLinks.map((item) => item.sortOrder)) + 1
    };
    tree.parentageLinks.push(link);
    return { id: link.id };
  });
}

export async function createDemoUnion(
  treeId: string,
  input: {
    expectedVersion: number;
    partnerIds: string[];
    childIds: string[];
    relationshipType: RelationshipType;
  }
) {
  return mutateTree(treeId, input.expectedVersion, (tree) => {
    input.partnerIds.forEach((id) => activePerson(tree, id));
    input.childIds.forEach((id) => activePerson(tree, id));
    if (input.partnerIds.some((id) => input.childIds.includes(id))) {
      throw new DemoStoreError("INVALID_RELATION", "Con không thể đồng thời là hôn phối trong cùng quan hệ.", 400);
    }
    const samePartners = (union: FamilyUnion) =>
      union.partnerIds.length === input.partnerIds.length &&
      union.partnerIds.every((id) => input.partnerIds.includes(id));
    if (tree.unions.some(samePartners)) {
      throw new DemoStoreError("INVALID_RELATION", "Quan hệ hôn phối này đã tồn tại.", 409);
    }
    const union: FamilyUnion = {
      id: crypto.randomUUID(),
      tenantId: tree.tenantId,
      treeId: tree.id,
      partnerIds: input.partnerIds,
      sortOrder: Math.max(0, ...tree.unions.map((item) => item.sortOrder)) + 1
    };
    tree.unions.push(union);
    for (const childId of input.childIds) {
      for (const parentId of input.partnerIds) {
        const existing = tree.parentageLinks.find(
          (link) => link.parentId === parentId && link.childId === childId
        );
        if (existing) {
          existing.unionId = union.id;
          existing.relationshipType = input.relationshipType;
        } else {
          tree.parentageLinks.push({
            id: crypto.randomUUID(),
            tenantId: tree.tenantId,
            treeId: tree.id,
            parentId,
            childId,
            unionId: union.id,
            relationshipType: input.relationshipType,
            sortOrder: Math.max(0, ...tree.parentageLinks.map((item) => item.sortOrder)) + 1
          });
        }
      }
    }
    return { id: union.id };
  });
}

export async function removeDemoRelation(
  treeId: string,
  input: { expectedVersion: number; kind: "parentage" | "union"; id: string }
) {
  return mutateTree(treeId, input.expectedVersion, (tree) => {
    if (input.kind === "parentage") {
      const before = tree.parentageLinks.length;
      tree.parentageLinks = tree.parentageLinks.filter((link) => link.id !== input.id);
      if (before === tree.parentageLinks.length) {
        throw new DemoStoreError("NOT_FOUND", "Không tìm thấy quan hệ.", 404);
      }
    } else {
      const before = tree.unions.length;
      tree.unions = tree.unions.filter((union) => union.id !== input.id);
      if (before === tree.unions.length) {
        throw new DemoStoreError("NOT_FOUND", "Không tìm thấy quan hệ hôn phối.", 404);
      }
      tree.parentageLinks.forEach((link) => {
        if (link.unionId === input.id) link.unionId = undefined;
      });
    }
    return { removed: true };
  });
}

export async function updateDemoTreeSettings(
  treeId: string,
  input: {
    expectedVersion: number;
    name: string;
    rootPersonId: string;
    visibility: TreeVisibility;
  }
) {
  return mutateTree(treeId, input.expectedVersion, (tree) => {
    activePerson(tree, input.rootPersonId);
    tree.name = input.name;
    tree.rootPersonId = input.rootPersonId;
    tree.visibility = input.visibility;
    return { updated: true };
  });
}
