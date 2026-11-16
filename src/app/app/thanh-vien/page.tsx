import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { MemberTable } from "@/components/member-table";
import { getCurrentTree } from "@/lib/repository/current-tenant";
import { getArchivedPeople } from "@/lib/repository/trees";

export const metadata: Metadata = { title: "Danh sách thành viên" };

export default async function MembersPage() {
  const tree = await getCurrentTree();
  const archivedPeople = await getArchivedPeople(tree.id);
  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome compact"><div><span>{tree.name}</span><h1>Thành viên dòng họ</h1><p>Tra cứu, cập nhật hồ sơ hoặc nhập danh sách từ Excel.</p></div><Link className="dashboard-primary-button" href="/admin/pha-do"><UserPlus /> Thêm thành viên</Link></div>
      <MemberTable people={tree.persons} archivedPeople={archivedPeople} treeId={tree.id} graphVersion={tree.graphVersion} />
    </div>
  );
}
