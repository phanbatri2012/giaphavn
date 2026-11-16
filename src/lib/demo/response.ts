import { NextResponse } from "next/server";
import { DemoStoreError } from "@/lib/demo/store";

export function demoStoreErrorResponse(error: unknown) {
  if (error instanceof DemoStoreError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.currentVersion === undefined ? {} : { currentVersion: error.currentVersion })
      },
      { status: error.status }
    );
  }
  console.error("Personal data store failed", error);
  return NextResponse.json({ error: "Không thể cập nhật dữ liệu gia phả local." }, { status: 500 });
}
