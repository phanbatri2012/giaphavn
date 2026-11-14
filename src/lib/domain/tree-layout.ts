import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api";
import type { FamilyTree } from "./types";

export type TreeLayoutNode = { id: string; x: number; y: number; width: number; height: number; kind: "person" | "union" };
export type TreeLayoutEdge = { id: string; points: Array<{ x: number; y: number }> };
export type TreeLayout = { width: number; height: number; nodes: TreeLayoutNode[]; edges: TreeLayoutEdge[] };

export function buildElkInput(tree: FamilyTree): ElkNode {
  const children = [
    ...tree.persons.filter((person) => !person.archivedAt).map((person) => ({
      id: person.id,
      width: 176,
      height: 78,
      layoutOptions: { "elk.layered.layering.layerConstraint": person.id === tree.rootPersonId ? "FIRST" : "NONE" }
    })),
    ...tree.unions.map((union) => ({ id: `union:${union.id}`, width: 24, height: 24 }))
  ];

  const unionChildren = new Map<string, Set<string>>();
  for (const link of tree.parentageLinks) {
    if (!link.unionId) continue;
    const childrenForUnion = unionChildren.get(link.unionId) ?? new Set<string>();
    childrenForUnion.add(link.childId);
    unionChildren.set(link.unionId, childrenForUnion);
  }

  const edges: Array<{ id: string; sources: string[]; targets: string[] }> = [];
  for (const union of tree.unions) {
    for (const partnerId of union.partnerIds) {
      edges.push({ id: `partner:${partnerId}:${union.id}`, sources: [partnerId], targets: [`union:${union.id}`] });
    }
    for (const childId of unionChildren.get(union.id) ?? []) {
      edges.push({ id: `child:${union.id}:${childId}`, sources: [`union:${union.id}`], targets: [childId] });
    }
  }
  for (const link of tree.parentageLinks.filter((item) => !item.unionId)) {
    edges.push({ id: `parent:${link.id}`, sources: [link.parentId], targets: [link.childId] });
  }

  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.spacing.nodeNode": "34",
      "elk.layered.spacing.nodeNodeBetweenLayers": "70",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.edgeRouting": "ORTHOGONAL"
    },
    children,
    edges
  };
}

export async function computeTreeLayout(tree: FamilyTree): Promise<TreeLayout> {
  const graph = await new ELK().layout(buildElkInput(tree));
  return {
    width: graph.width ?? 1000,
    height: graph.height ?? 600,
    nodes: (graph.children ?? []).map((node) => ({
      id: node.id,
      x: node.x ?? 0,
      y: node.y ?? 0,
      width: node.width ?? 0,
      height: node.height ?? 0,
      kind: node.id.startsWith("union:") ? "union" : "person"
    })),
    edges: (graph.edges ?? []).map((edge) => ({
      id: edge.id,
      points: (edge.sections ?? []).flatMap((section) => [section.startPoint, ...(section.bendPoints ?? []), section.endPoint])
    }))
  };
}

export function initialTreeGenerationLimit(tree: FamilyTree, selectedPersonId?: string) {
  if (tree.persons.length <= 200) return 99;
  const rootGeneration = tree.persons.find((person) => person.id === tree.rootPersonId)?.generation ?? 1;
  const selectedGeneration = tree.persons.find((person) => person.id === selectedPersonId)?.generation;
  return Math.max(rootGeneration + 4, selectedGeneration ?? 0);
}
