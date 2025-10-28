import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb, crmPipeline, contacts } from "@/db";
import { isAdminRequest } from "../../../../web/admin";
import { PIPELINE_STAGE_SET, type PipelineStage } from "../stages";
import { eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ contactId?: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { contactId } = await context.params;
  if (!contactId) {
    return NextResponse.json({ error: "contact_id_required" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { stage, notes } = payload as Record<string, unknown>;

  if (typeof stage !== "string" || stage.trim().length === 0) {
    return NextResponse.json({ error: "stage_required" }, { status: 400 });
  }

  const normalizedStage = stage.trim().toLowerCase();
  if (!PIPELINE_STAGE_SET.has(normalizedStage)) {
    return NextResponse.json({ error: "invalid_stage" }, { status: 400 });
  }
  const targetStage = normalizedStage as PipelineStage;

  const noteValue =
    typeof notes === "string"
      ? notes.trim().length > 0
        ? notes.trim()
        : null
      : notes === null
      ? null
      : undefined;

  const db = getDb();

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) {
    return NextResponse.json({ error: "contact_not_found" }, { status: 404 });
  }

  const now = new Date();

  const [pipeline] = await db
    .insert(crmPipeline)
    .values({
      contactId,
      stage: targetStage,
      notes: noteValue ?? null,
      createdAt: now,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: crmPipeline.contactId,
      set: {
        stage: targetStage,
        notes: noteValue ?? null,
        updatedAt: now
      }
    })
    .returning({
      contactId: crmPipeline.contactId,
      stage: crmPipeline.stage,
      notes: crmPipeline.notes,
      updatedAt: crmPipeline.updatedAt
    });

  if (!pipeline) {
    return NextResponse.json({ error: "pipeline_update_failed" }, { status: 500 });
  }

  return NextResponse.json({
    pipeline: {
      contactId: pipeline.contactId,
      stage: pipeline.stage,
      notes: pipeline.notes,
      updatedAt: pipeline.updatedAt.toISOString()
    }
  });
}
