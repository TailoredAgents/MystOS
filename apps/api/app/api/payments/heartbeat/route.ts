import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb, payments } from "@/db";
import { isAdminRequest } from "../../web/admin";

export async function GET(request: NextRequest): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({ createdAt: payments.createdAt })
    .from(payments)
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return NextResponse.json({
    lastPaymentAt: row?.createdAt ? row.createdAt.toISOString() : null
  });
}
