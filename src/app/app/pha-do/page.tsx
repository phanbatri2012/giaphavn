import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { TreeExplorer } from "@/components/tree-explorer";
import { getCurrentTree, getDashboardContext } from "@/lib/repository/current-tenant";
import { TreeManagementActions } from "@/components/tree-management-actions";

export const metadata: Metadata = { title: "Quản lý phả đồ" };

export default async function AdminTreePage({ searchParams }: { searchParams: Promise<{ person?: string }> }) {
  const [tree, context] = await Promise.all([getCurrentTree(), getDashboardContext()]);
  const { person } = await searchParams;
  return (
    <div className="dashboard-page tree-admin-page">
      <div className="dashboard-welcome compact">
        <div><span>{tree.name} · Phiên bản {tree.graphVersion}</span><h1>Chỉnh sửa phả đồ</h1><p>Chọn một người để xem chi tiết, thêm con hoặc tiếp tục một nhánh mới.</p></div>
        <div className="tree-heading-actions"><span className="privacy-pill"><LockKeyhole /> {tree.visibility === "protected" ? "Có mã bảo mật" : "Công khai có kiểm soát"}</span><TreeManagementActions tenantId={context.currentTenant.id} tree={tree} treeCount={context.trees.length} /></div>
      </div>
      <TreeExplorer key={`${tree.id}:${tree.graphVersion}`} initialTree={tree} initialPersonId={person} admin />
    </div>
  );
}
