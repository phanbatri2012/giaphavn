import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeVietnameseName } from "@/lib/domain/genealogy";
import { hasTrustedOrigin } from "@/lib/security/same-origin";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateDemoPerson } from "@/lib/demo/store";
import { demoStoreErrorResponse } from "@/lib/demo/response";

const partialDate = z.object({ value: z.string().max(10), precision: z.enum(["year", "month", "day"]), calendar: z.enum(["solar", "lunar"]) }).optional();
const schema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  fullName: z.string().trim().min(2).max(150),
  otherName: z.string().trim().max(150).optional().default(""),
  gender: z.enum(["male", "female", "other"]),
  roleTitle: z.string().trim().max(120).optional().default(""),
  avatarUrl: z.union([z.literal(""), z.string().regex(/^\/api\/(?:public\/)?media\/[0-9a-f-]{36}$/i)]).optional().default(""),
  generation: z.number().int().min(1).max(99),
  biography: z.string().trim().max(10000).optional().default(""),
  birthDate: partialDate,
  deathDate: partialDate,
  isDeceased: z.boolean(),
  address: z.string().trim().max(500).optional().default(""),
  education: z.string().trim().max(300).optional().default(""),
  religion: z.string().trim().max(150).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.union([z.literal(""), z.string().email().max(180)]).optional().default(""),
  publicFields: z.object({ avatar: z.boolean(), exactBirthDate: z.boolean(), phone: z.boolean(), email: z.boolean(), address: z.boolean(), biography: z.boolean() })
});

export async function PATCH(request: Request, context: { params: Promise<{ treeId: string; personId: string }> }) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  const { treeId, personId } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Hồ sơ thành viên không hợp lệ.", details: parsed.error.flatten() }, { status: 400 });
  if (!hasSupabaseConfig()) {
    try {
      const result = await updateDemoPerson(treeId, personId, parsed.data);
      return NextResponse.json({ ...result, demo: true });
    } catch (error) {
      return demoStoreErrorResponse(error);
    }
  }
  const supabase = await createSupabaseServerClient();
  const { data: scopedPerson } = await supabase.from("persons").select("id").eq("id", personId).eq("tree_id", treeId).maybeSingle();
  if (!scopedPerson) return NextResponse.json({ error: "Không tìm thấy thành viên." }, { status: 404 });
  const payload = {
    ...parsed.data,
    searchName: normalizeVietnameseName(parsed.data.fullName),
    birthValue: parsed.data.birthDate?.value ?? "",
    birthPrecision: parsed.data.birthDate?.precision ?? "",
    birthCalendar: parsed.data.birthDate?.calendar ?? "solar",
    deathValue: parsed.data.deathDate?.value ?? "",
    deathPrecision: parsed.data.deathDate?.precision ?? "",
    deathCalendar: parsed.data.deathDate?.calendar ?? "solar"
  };
  const { data, error } = await supabase.rpc("update_person_with_version", { p_person_id: personId, p_expected_version: parsed.data.expectedVersion, p_payload: payload });
  if (error?.message.includes("VERSION_CONFLICT")) return NextResponse.json({ error: "Phả đồ đã thay đổi.", code: "VERSION_CONFLICT" }, { status: 409 });
  if (error) return NextResponse.json({ error: "Không thể cập nhật thành viên." }, { status: 400 });
  return NextResponse.json(data);
}
