import type { FamilyTree } from "@/lib/domain/types";

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

export function renderTreeSvg(tree: FamilyTree) {
  const active = tree.persons.filter((person) => !person.archivedAt);
  const byGeneration = new Map<number, typeof active>();
  active.forEach((person) => byGeneration.set(person.generation, [...(byGeneration.get(person.generation) ?? []), person]));
  const generations = [...byGeneration.keys()].sort((a, b) => a - b);
  const width = Math.max(1200, ...generations.map((generation) => (byGeneration.get(generation)?.length ?? 1) * 220 + 100));
  const height = generations.length * 180 + 140;
  const positions = new Map<string, { x: number; y: number }>();
  generations.forEach((generation, generationIndex) => {
    const people = byGeneration.get(generation) ?? [];
    const gap = width / (people.length + 1);
    people.forEach((person, index) => positions.set(person.id, { x: gap * (index + 1), y: 100 + generationIndex * 180 }));
  });
  const lines = tree.parentageLinks.map((link) => {
    const parent = positions.get(link.parentId); const child = positions.get(link.childId);
    if (!parent || !child) return "";
    return `<path d="M${parent.x} ${parent.y + 64} V${(parent.y + child.y) / 2} H${child.x} V${child.y}" fill="none" stroke="#b98756" stroke-width="2"/>`;
  }).join("");
  const nodes = active.map((person) => {
    const position = positions.get(person.id)!;
    return `<g transform="translate(${position.x - 88} ${position.y})"><rect width="176" height="64" rx="12" fill="#fffaf0" stroke="#a83f24" stroke-width="2"/><text x="88" y="27" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#3f261c">${escapeXml(person.fullName)}</text><text x="88" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#795548">Đời ${person.generation}${person.roleTitle ? ` · ${escapeXml(person.roleTitle)}` : ""}</text></g>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8f1e3"/><text x="50" y="48" font-family="Arial, 'DejaVu Sans', sans-serif" font-size="24" font-weight="700" fill="#7a2c1b">${escapeXml(tree.name)}</text>${lines}${nodes}</svg>`;
}
