import { getDb, outboxEvents } from "@/db";

type Db = ReturnType<typeof getDb>;

export async function enqueueStageRequest(
  db: Db,
  contactId: string | null | undefined,
  stage: string,
  reason: string
): Promise<void> {
  if (!contactId) {
    return;
  }

  try {
    await db.insert(outboxEvents).values({
      type: "pipeline.stage_request",
      payload: {
        contactId,
        stage,
        reason
      }
    });
  } catch (error) {
    console.warn("[pipeline] enqueue_stage_request_failed", { contactId, stage, reason, error: String(error) });
  }
}

