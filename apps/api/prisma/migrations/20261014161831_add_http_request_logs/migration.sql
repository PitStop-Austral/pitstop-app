-- CreateEnum
CREATE TYPE "HttpRequestOutcome" AS ENUM ('COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "HttpRequestTrafficKind" AS ENUM ('APPLICATION', 'HEALTH', 'REPORTING', 'UNMATCHED');

-- CreateTable
CREATE TABLE "HttpRequestLog" (
    "id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "route" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" DOUBLE PRECISION NOT NULL,
    "statusCode" INTEGER,
    "outcome" "HttpRequestOutcome" NOT NULL,
    "trafficKind" "HttpRequestTrafficKind" NOT NULL,

    CONSTRAINT "HttpRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HttpRequestLog_startedAt_idx" ON "HttpRequestLog"("startedAt");

-- CreateIndex
CREATE INDEX "HttpRequestLog_trafficKind_startedAt_idx" ON "HttpRequestLog"("trafficKind", "startedAt");
