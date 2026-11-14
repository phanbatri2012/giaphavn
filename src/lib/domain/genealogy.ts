import type {
  FamilyTree,
  ParentageLink,
  Person,
  Plan,
  Subscription,
  SubscriptionStatus
} from "./types";

export function normalizeVietnameseName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (character) => (character === "đ" ? "d" : "D"))
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findCycle(personIds: string[], links: ParentageLink[]) {
  const adjacency = new Map<string, string[]>();
  for (const id of personIds) adjacency.set(id, []);
  for (const link of links) {
    const children = adjacency.get(link.parentId);
    if (children) children.push(link.childId);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  const walk = (id: string): string[] | undefined => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      return [...path.slice(start), id];
    }
    if (visited.has(id)) return undefined;

    visiting.add(id);
    path.push(id);
    for (const childId of adjacency.get(id) ?? []) {
      const cycle = walk(childId);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(id);
    visited.add(id);
    return undefined;
  };

  for (const id of personIds) {
    const cycle = walk(id);
    if (cycle) return cycle;
  }
  return undefined;
}

export function validateTree(tree: FamilyTree) {
  const errors: string[] = [];
  const personIds = new Set(tree.persons.filter((person) => !person.archivedAt).map((person) => person.id));

  if (!personIds.has(tree.rootPersonId)) errors.push("Người gốc không tồn tại hoặc đã được lưu trữ.");

  for (const union of tree.unions) {
    if (union.partnerIds.length < 1 || union.partnerIds.length > 2) {
      errors.push(`Liên minh ${union.id} phải có một hoặc hai thành viên.`);
    }
    if (new Set(union.partnerIds).size !== union.partnerIds.length) {
      errors.push(`Liên minh ${union.id} có thành viên bị lặp.`);
    }
    for (const partnerId of union.partnerIds) {
      if (!personIds.has(partnerId)) errors.push(`Liên minh ${union.id} tham chiếu thành viên không tồn tại.`);
    }
  }

  for (const link of tree.parentageLinks) {
    if (link.parentId === link.childId) errors.push("Một người không thể là cha/mẹ của chính mình.");
    if (!personIds.has(link.parentId) || !personIds.has(link.childId)) {
      errors.push(`Quan hệ ${link.id} tham chiếu thành viên không tồn tại.`);
    }
  }

  const cycle = findCycle([...personIds], tree.parentageLinks);
  if (cycle) errors.push(`Phả đồ có chu trình: ${cycle.join(" → ")}.`);
  return errors;
}

export type PublicPerson = Pick<
  Person,
  "id" | "fullName" | "gender" | "generation" | "roleTitle" | "isDeceased" | "sortOrder"
> &
  Partial<Pick<Person, "avatarUrl" | "birthDate" | "deathDate" | "phone" | "email" | "address" | "biography">>;

export function toPublicPerson(person: Person): PublicPerson {
  const base: PublicPerson = {
    id: person.id,
    fullName: person.fullName,
    gender: person.gender,
    generation: person.generation,
    roleTitle: person.roleTitle,
    isDeceased: person.isDeceased,
    sortOrder: person.sortOrder
  };

  if (person.publicFields.avatar) base.avatarUrl = person.avatarUrl;
  if (person.publicFields.exactBirthDate) base.birthDate = person.birthDate;
  if (person.isDeceased) base.deathDate = person.deathDate;
  if (person.publicFields.phone) base.phone = person.phone;
  if (person.publicFields.email) base.email = person.email;
  if (person.publicFields.address) base.address = person.address;
  if (person.publicFields.biography) base.biography = person.biography;
  return base;
}

export function canMutate(status: SubscriptionStatus) {
  return status === "free" || status === "active";
}

export function checkPersonLimit(plan: Plan, currentCount: number, addedCount = 1) {
  return {
    allowed: currentCount + addedCount <= plan.personLimit,
    remaining: Math.max(0, plan.personLimit - currentCount),
    limit: plan.personLimit
  };
}

export function nextSubscriptionPeriod(
  subscription: Subscription,
  paidAt: Date,
  kind: "purchase" | "renew" | "upgrade"
) {
  const paidTime = paidAt.getTime();
  const currentExpiry = subscription.expiresAt ? new Date(subscription.expiresAt).getTime() : 0;
  const start = kind === "renew" ? Math.max(paidTime, currentExpiry) : paidTime;
  const expiresAt = new Date(start);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 365);
  return {
    startsAt: new Date(paidTime).toISOString(),
    expiresAt: expiresAt.toISOString()
  };
}
