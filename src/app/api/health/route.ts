import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "giaphavn",
    mode: hasSupabaseConfig() ? "supabase" : "demo",
    timestamp: new Date().toISOString()
  });
}
