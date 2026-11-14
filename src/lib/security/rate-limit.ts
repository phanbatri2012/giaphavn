import "server-only";

import { createHmac } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Bucket = { count: number; resetAt: number };
type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number; available: boolean };

const buckets = new Map<string, Bucket>();

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0, available: true };
  }
  current.count += 1;
  return {
    allowed: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    retryAfter: Math.ceil((current.resetAt - now) / 1000),
    available: true
  };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) return memoryRateLimit(key, limit, windowMs);

  const secret = process.env.RATE_LIMIT_SECRET ?? process.env.TREE_ACCESS_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    return { allowed: false, remaining: 0, retryAfter: 60, available: false };
  }

  const keyHash = createHmac("sha256", secret).update(key).digest("hex");
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key_hash: keyHash,
    p_limit: limit,
    p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000))
  });
  if (error || !data || typeof data !== "object") {
    return { allowed: false, remaining: 0, retryAfter: 60, available: false };
  }
  const value = data as Record<string, unknown>;
  return {
    allowed: value.allowed === true,
    remaining: Number(value.remaining ?? 0),
    retryAfter: Number(value.retryAfter ?? 0),
    available: true
  };
}

export function clientAddress(headers: Headers) {
  return (
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
