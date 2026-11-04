CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "settings" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);