"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";

export function PlanCheckoutButton({ planId, label, tenantId, disabled = false }: { planId: string; label: string; tenantId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  async function checkout() {
    setLoading(true);
    const response = await fetch("/api/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId, tenantId, kind: "purchase" }) });
    const result = await response.json() as { checkoutUrl?: string; demo?: boolean; error?: string };
    setLoading(false);
    if (result.checkoutUrl) location.href = result.checkoutUrl;
    else if (result.demo) alert("Chế độ demo: đơn PayOS hợp lệ đã được tạo mô phỏng.");
    else alert(result.error ?? "Không thể tạo đơn thanh toán.");
  }
  return <button className="dashboard-primary-button" type="button" onClick={checkout} disabled={loading || disabled}>{loading ? <LoaderCircle className="spin" /> : disabled ? "Chưa mở trong pilot" : label}</button>;
}
