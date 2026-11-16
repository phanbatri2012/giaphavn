"use client";

import type { Person } from "@/lib/domain/types";
import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import { Download, FileUp, Pencil, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ImportExcelDialog } from "@/components/import-excel-dialog";

export function MemberTable({ people, archivedPeople, treeId, graphVersion: initialVersion }: { people: Person[]; archivedPeople: Person[]; treeId: string; graphVersion: number }) {
  const [query, setQuery] = useState("");
  const [importing, setImporting] = useState(false);
  const [activePeople, setActivePeople] = useState(people);
  const [trash, setTrash] = useState(archivedPeople);
  const [graphVersion, setGraphVersion] = useState(initialVersion);
  const [message, setMessage] = useState("");
  const normalized = normalizeVietnameseName(query);
  const filtered = useMemo(() => activePeople.filter((person) => person.searchName.includes(normalized)), [normalized, activePeople]);

  async function restore(person: Person) {
    setMessage("");
    const response = await fetch(`/api/trees/${treeId}/persons`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ personId: person.id, expectedVersion: graphVersion })
    });
    const result = await response.json() as { graphVersion?: number; error?: string };
    if (!response.ok) return setMessage(result.error ?? "Không thể phục hồi thành viên.");
    setGraphVersion(result.graphVersion ?? graphVersion + 1);
    setTrash((current) => current.filter((item) => item.id !== person.id));
    setActivePeople((current) => [...current, { ...person, archivedAt: undefined }]);
    setMessage(`Đã phục hồi ${person.fullName}.`);
  }

  return <>
    <section className="dashboard-panel members-panel">
      <div className="table-toolbar">
        <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên không dấu…" /></label>
        <div><button type="button" onClick={() => setImporting(true)}><FileUp /> Nhập Excel</button><a className="table-action-link" href={`/api/trees/${treeId}/export?format=xlsx`}><Download /> Xuất danh sách</a></div>
      </div>
      <div className="table-scroll"><table>
        <thead><tr><th>Thành viên</th><th>Đời</th><th>Năm sinh</th><th>Trạng thái</th><th>Vai vế</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>{filtered.map((person) => <tr key={person.id}>
          <td><span className={`member-avatar gender-${person.gender}`}>{person.fullName.charAt(0)}</span><div><strong>{person.fullName}</strong><small>{person.otherName ?? "Chưa có tên thường gọi"}</small></div></td>
          <td>Đời {person.generation}</td><td>{person.birthDate?.value ?? "—"}</td>
          <td><span className={person.isDeceased ? "status-chip neutral" : "status-chip active"}>{person.isDeceased ? "Đã mất" : "Còn sống"}</span></td>
          <td>{person.roleTitle ?? "Thành viên"}</td>
          <td><Link className="icon-button" href={`/admin/pha-do?person=${person.id}`} aria-label={`Sửa ${person.fullName}`}><Pencil /></Link></td>
        </tr>)}</tbody>
      </table></div>
      <div className="table-footer"><span>Hiển thị {filtered.length} / {activePeople.length} thành viên</span><span>Bản cá nhân · không giới hạn theo gói</span></div>
      {importing && <ImportExcelDialog treeId={treeId} onClose={() => setImporting(false)} />}
    </section>
    {trash.length > 0 && <section className="dashboard-panel member-trash">
      <div><h2>Thùng rác 30 ngày</h2><p>Thành viên sẽ bị xóa vĩnh viễn sau thời hạn lưu trữ.</p></div>
      <ul>{trash.map((person) => <li key={person.id}><span><strong>{person.fullName}</strong><small>Lưu trữ {person.archivedAt ? new Intl.DateTimeFormat("vi-VN").format(new Date(person.archivedAt)) : "gần đây"}</small></span><button type="button" onClick={() => restore(person)}><RotateCcw /> Phục hồi</button></li>)}</ul>
      {message && <p className={message.startsWith("Đã") ? "form-success" : "form-error"} role="status">{message}</p>}
    </section>}
  </>;
}
