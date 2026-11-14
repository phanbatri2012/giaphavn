"use client";

import type { FamilyTree, Person } from "@/lib/domain/types";
import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import { computeTreeLayout, initialTreeGenerationLimit, type TreeLayout } from "@/lib/domain/tree-layout";
import { select } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { Download, HeartHandshake, Link2, LocateFixed, Maximize2, Minus, Network, Pencil, Plus, Search, Trash2, Unlink, UserPlus, UsersRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function privateMediaUrl(value?: string) {
  return value?.replace("/api/public/media/", "/api/media/");
}

export function TreeExplorer({ initialTree, admin = false, initialPersonId }: { initialTree: FamilyTree; admin?: boolean; initialPersonId?: string }) {
  const router = useRouter();
  const [tree, setTree] = useState(initialTree);
  const [layout, setLayout] = useState<TreeLayout>();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialTree.persons.some((person) => person.id === initialPersonId) ? initialPersonId! : initialTree.rootPersonId);
  const [adding, setAdding] = useState<false | "parent" | "spouse" | "child">(false);
  const [editing, setEditing] = useState(false);
  const [managingRelations, setManagingRelations] = useState(false);
  const [generationLimit, setGenerationLimit] = useState(() => initialTreeGenerationLimit(initialTree, initialPersonId));
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | undefined>(undefined);
  const maxGeneration = useMemo(() => tree.persons.length ? Math.max(...tree.persons.map((person) => person.generation)) : 1, [tree.persons]);
  const visibleTree = useMemo(() => {
    const children = new Map<string, string[]>();
    for (const link of tree.parentageLinks) children.set(link.parentId, [...(children.get(link.parentId) ?? []), link.childId]);
    const hidden = new Set<string>();
    for (const collapsedId of collapsedIds) {
      const queue = [...(children.get(collapsedId) ?? [])];
      while (queue.length) {
        const id = queue.shift()!;
        if (hidden.has(id)) continue;
        hidden.add(id); queue.push(...(children.get(id) ?? []));
      }
    }
    const persons = tree.persons.filter((person) => person.generation <= generationLimit && !hidden.has(person.id));
    const visibleIds = new Set(persons.map((person) => person.id));
    const unions = tree.unions.filter((union) => union.partnerIds.length > 0 && union.partnerIds.every((id) => visibleIds.has(id)));
    const unionIds = new Set(unions.map((union) => union.id));
    const parentageLinks = tree.parentageLinks.filter((link) => visibleIds.has(link.parentId) && visibleIds.has(link.childId) && (!link.unionId || unionIds.has(link.unionId)));
    return { ...tree, persons, unions, parentageLinks };
  }, [collapsedIds, generationLimit, tree]);

  useEffect(() => {
    let active = true;
    computeTreeLayout(visibleTree).then((result) => active && setLayout(result));
    return () => { active = false; };
  }, [visibleTree]);

  useEffect(() => {
    if (!svgRef.current || !viewportRef.current || !layout) return;
    const svg = select(svgRef.current);
    const viewport = select(viewportRef.current);
    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.22, 2.4])
      .on("zoom", (event) => viewport.attr("transform", event.transform.toString()));
    zoomRef.current = zoomBehavior;
    svg.call(zoomBehavior);
    const bounds = svgRef.current.getBoundingClientRect();
    const fitScale = Math.min(1, (bounds.width - 80) / layout.width, (bounds.height - 80) / layout.height);
    const x = (bounds.width - layout.width * fitScale) / 2;
    const y = 42;
    svg.call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(fitScale));
    return () => { svg.on(".zoom", null); };
  }, [layout]);

  const personMap = useMemo(() => new Map(tree.persons.map((person) => [person.id, person])), [tree.persons]);
  const normalizedQuery = normalizeVietnameseName(query);
  const matchingIds = useMemo(
    () => new Set(tree.persons.filter((person) => person.searchName.includes(normalizedQuery)).map((person) => person.id)),
    [normalizedQuery, tree.persons]
  );
  const selectedPerson = personMap.get(selectedId);

  function zoomBy(multiplier: number) {
    if (!svgRef.current || !zoomRef.current) return;
    select(svgRef.current).call(zoomRef.current.scaleBy, multiplier);
  }

  function fit() {
    if (!svgRef.current || !zoomRef.current || !layout) return;
    const bounds = svgRef.current.getBoundingClientRect();
    const scale = Math.min(1, (bounds.width - 70) / layout.width, (bounds.height - 70) / layout.height);
    select(svgRef.current).call(
      zoomRef.current.transform,
      zoomIdentity.translate((bounds.width - layout.width * scale) / 2, 35).scale(scale)
    );
  }

  function focusRoot() {
    if (!svgRef.current || !zoomRef.current || !layout) return;
    const root = layout.nodes.find((node) => node.id === tree.rootPersonId);
    if (!root) return fit();
    const bounds = svgRef.current.getBoundingClientRect();
    const scale = 1;
    select(svgRef.current).call(
      zoomRef.current.transform,
      zoomIdentity.translate(bounds.width / 2 - (root.x + root.width / 2) * scale, 55 - root.y * scale).scale(scale)
    );
    setSelectedId(tree.rootPersonId);
  }

  function toggleBranch(personId: string) {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId); else next.add(personId);
      return next;
    });
  }

  function exportSvg() {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([clone.outerHTML], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pha-do-gia-phavn.svg";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function addPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMutationError("");
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("fullName") ?? "").trim();
    const gender = String(data.get("gender")) as Person["gender"];
    const anchorId = selectedPerson?.id ?? tree.rootPersonId;
    if (!fullName) { setSaving(false); return; }
    const anchor = personMap.get(anchorId);
    const relation = adding || "child";
    const relationshipType = String(data.get("relationshipType") ?? "biological") as "biological" | "adoptive" | "step" | "guardian";
    const response = await fetch(`/api/trees/${tree.id}/persons`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expectedVersion: tree.graphVersion, fullName, gender, relation, anchorId, relationshipType })
    });
    const result = await response.json() as { id?: string; unionId?: string; generation?: number; rebased?: boolean; graphVersion?: number; error?: string; code?: string };
    setSaving(false);
    if (!response.ok || !result.id) {
      setMutationError(result.error ?? "Không thể thêm thành viên.");
      if (response.status === 409) router.refresh();
      return;
    }
    const id = result.id;
    const newPerson: Person = {
      id,
      tenantId: tree.tenantId,
      treeId: tree.id,
      fullName,
      searchName: normalizeVietnameseName(fullName),
      gender,
      generation: result.generation ?? (relation === "parent" ? Math.max(1, (anchor?.generation ?? 2) - 1) : relation === "spouse" ? (anchor?.generation ?? 1) : (anchor?.generation ?? 0) + 1),
      isDeceased: false,
      publicFields: {
        avatar: true,
        exactBirthDate: false,
        phone: false,
        email: false,
        address: false,
        biography: false
      },
      sortOrder: tree.persons.length + 1
    };
    setTree((current) => {
      const persons = result.rebased ? current.persons.map((person) => ({ ...person, generation: person.generation + 1 })) : current.persons;
      const relationLink = relation === "spouse" ? [] : [{
        id: `link-${id}`,
        tenantId: current.tenantId,
        treeId: current.id,
        parentId: relation === "parent" ? id : anchorId,
        childId: relation === "parent" ? anchorId : id,
        relationshipType,
        sortOrder: 99
      }];
      return {
        ...current,
        graphVersion: result.graphVersion ?? current.graphVersion + 1,
        persons: [...persons, newPerson],
        unions: relation === "spouse" ? [...current.unions, { id: result.unionId ?? `union-${id}`, tenantId: current.tenantId, treeId: current.id, partnerIds: [anchorId, id], sortOrder: current.unions.length + 1 }] : current.unions,
        parentageLinks: [...current.parentageLinks, ...relationLink]
      };
    });
    setSelectedId(id);
    setAdding(false);
  }

  async function savePerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPerson) return;
    setSaving(true); setMutationError("");
    const data = new FormData(event.currentTarget);
    const partialDate = (prefix: "birth" | "death") => {
      const value = String(data.get(`${prefix}Value`) ?? "").trim();
      return value ? { value, precision: String(data.get(`${prefix}Precision`)) as "year" | "month" | "day", calendar: String(data.get(`${prefix}Calendar`)) as "solar" | "lunar" } : undefined;
    };
    const publicFields = {
      avatar: data.get("publicAvatar") === "on",
      exactBirthDate: data.get("publicBirth") === "on",
      phone: data.get("publicPhone") === "on",
      email: data.get("publicEmail") === "on",
      address: data.get("publicAddress") === "on",
      biography: data.get("publicBiography") === "on"
    };
    const isDeceased = data.get("isDeceased") === "on";
    let avatarUrl = selectedPerson.avatarUrl ?? "";
    const avatarFile = data.get("avatarFile");
    if (avatarFile instanceof File && avatarFile.size > 0) {
      const ticketResponse = await fetch("/api/media/upload-ticket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: tree.tenantId, filename: avatarFile.name, mimeType: avatarFile.type, size: avatarFile.size }) });
      const ticket = await ticketResponse.json() as { path?: string; token?: string; demo?: boolean; error?: string };
      if (!ticketResponse.ok || !ticket.path) { setSaving(false); setMutationError(ticket.error ?? "Không thể tải ảnh đại diện."); return; }
      if (!ticket.demo) {
        const supabase = createSupabaseBrowserClient();
        if (!supabase || !ticket.token) { setSaving(false); setMutationError("Storage chưa được cấu hình."); return; }
        const upload = await supabase.storage.from("tenant-media").uploadToSignedUrl(ticket.path, ticket.token, avatarFile, { contentType: avatarFile.type });
        if (upload.error) { setSaving(false); setMutationError("Không thể tải ảnh đại diện."); return; }
      }
      const finalizeResponse = await fetch("/api/media/finalize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantId: tree.tenantId, path: ticket.path, mimeType: avatarFile.type, size: avatarFile.size, isPublic: false }) });
      const finalized = await finalizeResponse.json() as { id?: string; publicUrl?: string; error?: string };
      if (!finalizeResponse.ok || !finalized.id) { setSaving(false); setMutationError(finalized.error ?? "Không thể hoàn tất ảnh đại diện."); return; }
      avatarUrl = `/api/media/${finalized.id}`;
    }
    const payload = {
      expectedVersion: tree.graphVersion,
      fullName: String(data.get("fullName") ?? ""),
      otherName: String(data.get("otherName") ?? ""),
      gender: String(data.get("gender")),
      roleTitle: String(data.get("roleTitle") ?? ""),
      avatarUrl,
      generation: Number(data.get("generation")),
      biography: String(data.get("biography") ?? ""),
      birthDate: partialDate("birth"), deathDate: partialDate("death"),
      isDeceased,
      address: String(data.get("address") ?? ""), education: String(data.get("education") ?? ""), religion: String(data.get("religion") ?? ""),
      phone: String(data.get("phone") ?? ""), email: String(data.get("email") ?? ""), publicFields
    };
    const response = await fetch(`/api/trees/${tree.id}/persons/${selectedPerson.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json() as { graphVersion?: number; error?: string };
    setSaving(false);
    if (!response.ok) {
      setMutationError(result.error ?? "Không thể cập nhật thành viên.");
      if (response.status === 409) router.refresh();
      return;
    }
    const updated: Person = {
      ...selectedPerson,
      fullName: payload.fullName.trim(), searchName: normalizeVietnameseName(payload.fullName), otherName: payload.otherName || undefined,
      gender: payload.gender as Person["gender"], roleTitle: payload.roleTitle || undefined, generation: payload.generation,
      avatarUrl: payload.avatarUrl || undefined,
      biography: payload.biography || undefined, birthDate: payload.birthDate, deathDate: payload.deathDate, isDeceased: payload.isDeceased,
      address: payload.address || undefined, education: payload.education || undefined, religion: payload.religion || undefined,
      phone: payload.phone || undefined, email: payload.email || undefined, publicFields
    };
    setTree((current) => ({ ...current, graphVersion: result.graphVersion ?? current.graphVersion + 1, persons: current.persons.map((person) => person.id === updated.id ? updated : person) }));
    setEditing(false);
  }

  async function archivePerson() {
    if (!selectedPerson || !window.confirm(`Lưu trữ “${selectedPerson.fullName}” trong 30 ngày?`)) return;
    setSaving(true); setMutationError("");
    const response = await fetch(`/api/trees/${tree.id}/persons`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ personId: selectedPerson.id, expectedVersion: tree.graphVersion }) });
    const result = await response.json() as { graphVersion?: number; error?: string };
    setSaving(false);
    if (!response.ok) { setMutationError(result.error ?? "Không thể lưu trữ thành viên."); return; }
    const id = selectedPerson.id;
    setTree((current) => ({
      ...current,
      graphVersion: result.graphVersion ?? current.graphVersion + 1,
      persons: current.persons.filter((person) => person.id !== id),
      unions: current.unions.filter((union) => !union.partnerIds.includes(id)),
      parentageLinks: current.parentageLinks.filter((link) => link.parentId !== id && link.childId !== id)
    }));
    setSelectedId(tree.rootPersonId);
    setEditing(false);
  }

  async function linkExisting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPerson) return;
    const form = new FormData(event.currentTarget);
    const relation = String(form.get("relation")) as "parent" | "spouse" | "child";
    const otherId = String(form.get("personId"));
    const relationshipType = String(form.get("relationshipType")) as "biological" | "adoptive" | "step" | "guardian";
    if (!otherId || otherId === selectedPerson.id) return;
    setSaving(true); setMutationError("");
    const endpoint = relation === "spouse" ? `/api/trees/${tree.id}/unions` : `/api/trees/${tree.id}/relations`;
    const payload = relation === "spouse"
      ? { expectedVersion: tree.graphVersion, partnerIds: [selectedPerson.id, otherId], childIds: [], relationshipType }
      : { expectedVersion: tree.graphVersion, parentId: relation === "parent" ? otherId : selectedPerson.id, childId: relation === "parent" ? selectedPerson.id : otherId, relationshipType };
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json() as { id?: string; graphVersion?: number; error?: string };
    setSaving(false);
    if (!response.ok || !result.id) { setMutationError(result.error ?? "Không thể tạo quan hệ."); if (response.status === 409) router.refresh(); return; }
    setTree((current) => relation === "spouse" ? {
      ...current, graphVersion: result.graphVersion ?? current.graphVersion + 1,
      unions: [...current.unions, { id: result.id!, tenantId: current.tenantId, treeId: current.id, partnerIds: [selectedPerson.id, otherId], sortOrder: current.unions.length }]
    } : {
      ...current, graphVersion: result.graphVersion ?? current.graphVersion + 1,
      parentageLinks: [...current.parentageLinks.filter((link) => !(link.parentId === payload.parentId && link.childId === payload.childId)), { id: result.id!, tenantId: current.tenantId, treeId: current.id, parentId: payload.parentId!, childId: payload.childId!, relationshipType, sortOrder: current.parentageLinks.length }]
    });
    event.currentTarget.reset();
  }

  async function removeRelation(kind: "parentage" | "union", id: string) {
    if (!window.confirm("Gỡ quan hệ này khỏi phả đồ? Thành viên vẫn được giữ lại.")) return;
    setSaving(true); setMutationError("");
    const response = await fetch(`/api/trees/${tree.id}/relations`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id, expectedVersion: tree.graphVersion }) });
    const result = await response.json() as { graphVersion?: number; error?: string };
    setSaving(false);
    if (!response.ok) { setMutationError(result.error ?? "Không thể gỡ quan hệ."); if (response.status === 409) router.refresh(); return; }
    setTree((current) => kind === "parentage" ? { ...current, graphVersion: result.graphVersion ?? current.graphVersion + 1, parentageLinks: current.parentageLinks.filter((link) => link.id !== id) } : { ...current, graphVersion: result.graphVersion ?? current.graphVersion + 1, unions: current.unions.filter((union) => union.id !== id), parentageLinks: current.parentageLinks.map((link) => link.unionId === id ? { ...link, unionId: undefined } : link) });
  }

  return (
    <div className={admin ? "tree-workspace admin-tree" : "tree-workspace"}>
      <div className="tree-toolbar">
        <label className="tree-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm thành viên không dấu…" />
        </label>
        <div className="tree-toolbar-actions">
          <button type="button" onClick={() => zoomBy(1.22)} aria-label="Phóng to"><Plus /></button>
          <button type="button" onClick={() => zoomBy(.82)} aria-label="Thu nhỏ"><Minus /></button>
          <button type="button" onClick={focusRoot} aria-label="Về người gốc"><LocateFixed /></button>
          <button type="button" onClick={fit} aria-label="Vừa khung"><Maximize2 /></button>
          <label className="generation-filter"><span className="sr-only">Số đời hiển thị</span><select value={generationLimit} onChange={(event) => setGenerationLimit(Number(event.target.value))}><option value={99}>Tất cả đời</option>{Array.from({ length: maxGeneration }, (_, index) => index + 1).map((generation) => <option value={generation} key={generation}>Đến đời {generation}</option>)}</select></label>
          <button type="button" onClick={exportSvg} aria-label="Tải SVG"><Download /></button>
          {admin && <select className="tree-export-select" aria-label="Xuất phả đồ" defaultValue="" onChange={(event) => { if (event.target.value) router.push(`/api/trees/${tree.id}/export?format=${event.target.value}`); event.target.value = ""; }}><option value="" disabled>Xuất file…</option><option value="xlsx">Excel</option><option value="svg">SVG</option><option value="png">PNG</option><option value="pdf">PDF</option></select>}
          {admin && <button className="add-person-button" type="button" onClick={() => setAdding("child")}><UserPlus /> Thêm người</button>}
        </div>
      </div>
      <div className="tree-stage">
        {!layout ? (
          <div className="tree-loading">Đang sắp xếp phả đồ…</div>
        ) : (
          <svg ref={svgRef} className="tree-canvas" role="group" aria-label={`Phả đồ gồm ${tree.persons.length} thành viên`}>
            <defs>
              <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="150%">
                <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#5d2e1b" floodOpacity=".14" />
              </filter>
            </defs>
            <g ref={viewportRef}>
              <g className="graph-edges">
                {layout.edges.map((edge) => (
                  <path
                    key={edge.id}
                    d={edge.points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ")}
                  />
                ))}
              </g>
              {layout.nodes.map((node) => {
                if (node.kind === "union") {
                  return (
                    <g key={node.id} transform={`translate(${node.x} ${node.y})`} className="union-node">
                      <rect x="3" y="3" width="18" height="18" rx="5" transform="rotate(45 12 12)" />
                    </g>
                  );
                }
                const person = personMap.get(node.id);
                if (!person) return null;
                const isMatch = normalizedQuery.length > 0 && matchingIds.has(person.id);
                const isSelected = selectedId === person.id;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x} ${node.y})`}
                    className={`person-node gender-${person.gender}${isMatch ? " is-match" : ""}${isSelected ? " is-selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(person.id)}
                    onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && setSelectedId(person.id)}
                  >
                    <rect width={node.width} height={node.height} rx="14" filter="url(#node-shadow)" />
                    <circle cx="25" cy="27" r="13" />
                    <text className="person-initial" x="25" y="32" textAnchor="middle">{person.fullName.charAt(0)}</text>
                    <text className="person-name" x="48" y="27">{person.fullName}</text>
                    <text className="person-meta" x="48" y="48">
                      {person.roleTitle ?? `Đời ${person.generation}`} · {person.birthDate?.value ?? "Chưa rõ năm sinh"}
                    </text>
                    <text className="person-generation" x="158" y="66" textAnchor="end">Đời {person.generation}</text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
        {selectedPerson && (
          <aside className="person-detail-panel">
            <button type="button" aria-label="Đóng thông tin" onClick={() => setSelectedId("")}><X /></button>
            <span className={`detail-avatar gender-${selectedPerson.gender}`}>{selectedPerson.avatarUrl ? <Image src={admin ? privateMediaUrl(selectedPerson.avatarUrl)! : selectedPerson.avatarUrl} alt="" width={64} height={64} unoptimized /> : selectedPerson.fullName.charAt(0)}</span>
            <small>Đời {selectedPerson.generation}</small>
            <h3>{selectedPerson.fullName}</h3>
            <p>{selectedPerson.roleTitle ?? "Thành viên dòng họ"}</p>
            <dl>
              <div><dt>Năm sinh</dt><dd>{selectedPerson.birthDate?.value ?? "Chưa cập nhật"}</dd></div>
              <div><dt>Trạng thái</dt><dd>{selectedPerson.isDeceased ? "Đã mất" : "Còn sống"}</dd></div>
            </dl>
            {admin && <div className="person-detail-actions">
              <button className="tenant-button small" type="button" onClick={() => setAdding("child")}><UserPlus /> Thêm con</button>
              <button type="button" onClick={() => setAdding("parent")}><UsersRound /> Thêm cha/mẹ</button>
              <button type="button" onClick={() => setAdding("spouse")}><HeartHandshake /> Thêm hôn phối</button>
              <button type="button" onClick={() => toggleBranch(selectedPerson.id)}><Network /> {collapsedIds.has(selectedPerson.id) ? "Mở nhánh" : "Thu nhánh"}</button>
              <button type="button" onClick={() => { setMutationError(""); setManagingRelations(true); }}><Link2 /> Quan hệ</button>
              <button type="button" onClick={() => { setMutationError(""); setEditing(true); }}><Pencil /> Sửa hồ sơ</button>
            </div>}
          </aside>
        )}
      </div>
      <div className="tree-status-line">
        <span>Hiển thị {visibleTree.persons.length} / {tree.persons.length} thành viên · {maxGeneration} thế hệ</span>
        <span>Phiên bản {tree.graphVersion}</span>
      </div>
      {adding && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setAdding(false)}>
          <form className="tree-dialog" onSubmit={addPerson} onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" aria-label="Đóng" onClick={() => setAdding(false)}><X /></button>
            <span className="eyebrow"><i />Optimistic concurrency</span>
            <h2>{adding === "parent" ? "Thêm cha/mẹ của" : adding === "spouse" ? "Thêm hôn phối của" : "Thêm con của"} {selectedPerson?.fullName ?? "người gốc"}</h2>
            <label>Họ và tên<input name="fullName" required autoFocus /></label>
            <label>Giới tính<select name="gender" defaultValue="male"><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></label>
            {adding !== "spouse" && <label>Loại quan hệ<select name="relationshipType" defaultValue="biological"><option value="biological">Sinh học</option><option value="adoptive">Nhận nuôi</option><option value="step">Cha/mẹ kế</option><option value="guardian">Người giám hộ</option></select></label>}
            <p>Quan hệ mới được kiểm tra hạn mức, tenant và phiên bản phả đồ trước khi ghi.</p>
            {mutationError && <p className="form-error" role="alert">{mutationError}</p>}
            <button className="tenant-button" type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Thêm vào phả đồ"}</button>
          </form>
        </div>
      )}
      {editing && selectedPerson && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setEditing(false)}>
          <form className="tree-dialog person-editor-dialog" onSubmit={savePerson} onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" aria-label="Đóng" onClick={() => setEditing(false)}><X /></button>
            <span className="eyebrow"><i /><Pencil /> Hồ sơ thành viên</span>
            <h2>{selectedPerson.fullName}</h2>
            <div className="person-form-grid">
              <label>Họ và tên<input name="fullName" required maxLength={150} defaultValue={selectedPerson.fullName} /></label>
              <label>Tên thường gọi<input name="otherName" maxLength={150} defaultValue={selectedPerson.otherName} /></label>
              <label>Giới tính<select name="gender" defaultValue={selectedPerson.gender}><option value="male">Nam</option><option value="female">Nữ</option><option value="other">Khác</option></select></label>
              <label>Đời<input name="generation" type="number" min={1} max={99} required defaultValue={selectedPerson.generation} /></label>
              <label>Vai vế<input name="roleTitle" maxLength={120} defaultValue={selectedPerson.roleTitle} /></label>
              <label>Ảnh đại diện<input name="avatarFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />{selectedPerson.avatarUrl && <small>Đã có ảnh; chọn tệp mới để thay.</small>}</label>
              <label>Tôn giáo<input name="religion" maxLength={150} defaultValue={selectedPerson.religion} /></label>
              <fieldset className="partial-date-field"><legend>Ngày sinh</legend><input name="birthValue" defaultValue={selectedPerson.birthDate?.value} placeholder="YYYY, YYYY-MM hoặc YYYY-MM-DD" /><select name="birthPrecision" defaultValue={selectedPerson.birthDate?.precision ?? "day"}><option value="year">Năm</option><option value="month">Tháng</option><option value="day">Ngày</option></select><select name="birthCalendar" defaultValue={selectedPerson.birthDate?.calendar ?? "solar"}><option value="solar">Dương lịch</option><option value="lunar">Âm lịch</option></select></fieldset>
              <fieldset className="partial-date-field"><legend>Ngày mất</legend><input name="deathValue" defaultValue={selectedPerson.deathDate?.value} placeholder="YYYY, YYYY-MM hoặc YYYY-MM-DD" /><select name="deathPrecision" defaultValue={selectedPerson.deathDate?.precision ?? "day"}><option value="year">Năm</option><option value="month">Tháng</option><option value="day">Ngày</option></select><select name="deathCalendar" defaultValue={selectedPerson.deathDate?.calendar ?? "solar"}><option value="solar">Dương lịch</option><option value="lunar">Âm lịch</option></select></fieldset>
              <label className="toggle-row compact"><span><strong>Đã mất</strong></span><input name="isDeceased" type="checkbox" defaultChecked={selectedPerson.isDeceased} /></label>
              <label>Học vấn<input name="education" maxLength={300} defaultValue={selectedPerson.education} /></label>
              <label>Số điện thoại<input name="phone" maxLength={30} defaultValue={selectedPerson.phone} /></label>
              <label>Email<input name="email" type="email" maxLength={180} defaultValue={selectedPerson.email} /></label>
              <label className="span-two">Địa chỉ<input name="address" maxLength={500} defaultValue={selectedPerson.address} /></label>
              <label className="span-two">Tiểu sử<textarea name="biography" rows={4} maxLength={10000} defaultValue={selectedPerson.biography} /></label>
            </div>
            <fieldset className="privacy-fieldset"><legend>Thông tin được công khai khi người này còn sống</legend><label><input name="publicAvatar" type="checkbox" defaultChecked={selectedPerson.publicFields.avatar} /> Ảnh đại diện</label><label><input name="publicBirth" type="checkbox" defaultChecked={selectedPerson.publicFields.exactBirthDate} /> Ngày sinh đầy đủ</label><label><input name="publicPhone" type="checkbox" defaultChecked={selectedPerson.publicFields.phone} /> Điện thoại</label><label><input name="publicEmail" type="checkbox" defaultChecked={selectedPerson.publicFields.email} /> Email</label><label><input name="publicAddress" type="checkbox" defaultChecked={selectedPerson.publicFields.address} /> Địa chỉ</label><label><input name="publicBiography" type="checkbox" defaultChecked={selectedPerson.publicFields.biography} /> Tiểu sử</label></fieldset>
            {mutationError && <p className="form-error" role="alert">{mutationError}</p>}
            <div className="tree-dialog-actions"><button className="danger-button" type="button" onClick={archivePerson} disabled={saving}><Trash2 /> Lưu trữ 30 ngày</button><button className="tenant-button" disabled={saving}>{saving ? "Đang lưu…" : "Lưu hồ sơ"}</button></div>
          </form>
        </div>
      )}
      {managingRelations && selectedPerson && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setManagingRelations(false)}>
          <div className="tree-dialog relation-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <button className="dialog-close" type="button" aria-label="Đóng" onClick={() => setManagingRelations(false)}><X /></button>
            <span className="eyebrow"><i /><Link2 /> Quản lý quan hệ</span><h2>{selectedPerson.fullName}</h2>
            <div className="relation-list">
              {tree.parentageLinks.filter((link) => link.childId === selectedPerson.id || link.parentId === selectedPerson.id).map((link) => { const other = personMap.get(link.childId === selectedPerson.id ? link.parentId : link.childId); return <div key={link.id}><span><strong>{link.childId === selectedPerson.id ? "Cha/mẹ" : "Con"}: {other?.fullName ?? "Không rõ"}</strong><small>{link.relationshipType}</small></span><button type="button" onClick={() => removeRelation("parentage", link.id)} disabled={saving}><Unlink /></button></div>; })}
              {tree.unions.filter((union) => union.partnerIds.includes(selectedPerson.id)).map((union) => { const spouses = union.partnerIds.filter((id) => id !== selectedPerson.id).map((id) => personMap.get(id)?.fullName).filter(Boolean).join(", "); return <div key={union.id}><span><strong>Hôn phối: {spouses || "Liên minh đơn"}</strong><small>Quan hệ hôn phối</small></span><button type="button" onClick={() => removeRelation("union", union.id)} disabled={saving}><Unlink /></button></div>; })}
              {!tree.parentageLinks.some((link) => link.childId === selectedPerson.id || link.parentId === selectedPerson.id) && !tree.unions.some((union) => union.partnerIds.includes(selectedPerson.id)) && <p className="empty-state">Chưa có quan hệ.</p>}
            </div>
            <form className="relation-add-form" onSubmit={linkExisting}><h3>Nối với người đã có</h3><label>Người liên kết<select name="personId" required defaultValue=""><option value="" disabled>Chọn thành viên</option>{tree.persons.filter((person) => person.id !== selectedPerson.id).map((person) => <option value={person.id} key={person.id}>{person.fullName} · Đời {person.generation}</option>)}</select></label><label>Quan hệ<select name="relation" defaultValue="child"><option value="parent">Là cha/mẹ của người đang chọn</option><option value="spouse">Là hôn phối của người đang chọn</option><option value="child">Là con của người đang chọn</option></select></label><label>Loại quan hệ<select name="relationshipType" defaultValue="biological"><option value="biological">Sinh học</option><option value="adoptive">Nhận nuôi</option><option value="step">Cha/mẹ kế</option><option value="guardian">Người giám hộ</option></select></label>{mutationError && <p className="form-error">{mutationError}</p>}<button className="tenant-button" disabled={saving}>{saving ? "Đang nối…" : "Tạo quan hệ"}</button></form>
          </div>
        </div>
      )}
    </div>
  );
}
