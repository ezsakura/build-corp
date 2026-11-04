CREATE TABLE "WorkType" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkType_enabled_sortOrder_idx" ON "WorkType"("enabled", "sortOrder");

ALTER TABLE "Lead" ALTER COLUMN "service" TYPE TEXT USING "service"::text;
UPDATE "Lead" SET "service" = CASE "service"
    WHEN 'ROOF' THEN 'Кровля'
    WHEN 'WALLS' THEN 'Стены и фасады'
    WHEN 'FOUNDATION' THEN 'Фундамент'
    ELSE "service"
END;
ALTER TABLE "Lead"
    ADD COLUMN "quantity" DOUBLE PRECISION,
    ADD COLUMN "unit" TEXT,
    ADD COLUMN "estimate" DOUBLE PRECISION;

DROP TYPE "ServiceKey";