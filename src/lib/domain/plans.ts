import type { Plan } from "./types";

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Miễn phí",
    annualPrice: 0,
    personLimit: 50,
    adminLimit: 1,
    storageLimitBytes: 500 * 1024 * 1024
  },
  {
    id: "basic",
    name: "Cơ bản",
    annualPrice: 499_000,
    personLimit: 200,
    adminLimit: 3,
    storageLimitBytes: 2 * 1024 * 1024 * 1024
  },
  {
    id: "community",
    name: "Đoàn viên",
    annualPrice: 999_000,
    personLimit: 500,
    adminLimit: 5,
    storageLimitBytes: 5 * 1024 * 1024 * 1024,
    highlighted: true
  }
];

export function formatVnd(value: number) {
  if (value === 0) return "0 đ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatBytes(value: number) {
  if (value < 1024 * 1024 * 1024) return `${Math.round(value / 1024 / 1024)} MB`;
  return `${Math.round(value / 1024 / 1024 / 1024)} GB`;
}
