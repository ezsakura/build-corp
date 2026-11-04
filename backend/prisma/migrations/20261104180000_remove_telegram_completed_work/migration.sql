ALTER TYPE "LeadStatus" ADD VALUE 'COMPLETED';

DROP TABLE "TelegramOutbox";
DROP TYPE "OutboxStatus";

ALTER TABLE "Project"
    ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "duration" TEXT,
    ADD COLUMN "leadId" TEXT;

CREATE UNIQUE INDEX "Project_leadId_key" ON "Project"("leadId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;