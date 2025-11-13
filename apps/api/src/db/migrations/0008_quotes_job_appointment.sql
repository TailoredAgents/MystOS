ALTER TABLE "quotes"
ADD COLUMN "job_appointment_id" uuid;

ALTER TABLE "quotes"
ADD CONSTRAINT "quotes_job_appointment_id_fkey"
FOREIGN KEY ("job_appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL;

CREATE INDEX "quotes_job_appointment_idx" ON "quotes" ("job_appointment_id");
