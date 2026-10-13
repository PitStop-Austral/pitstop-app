-- CreateEnum
CREATE TYPE "KpiEnvironment" AS ENUM ('DEV', 'PROD');

-- CreateEnum
CREATE TYPE "KpiRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "KpiResultStatus" AS ENUM ('READY', 'NO_DATA', 'ERROR');

-- CreateTable
CREATE TABLE "kpi_runs" (
    "id" UUID NOT NULL,
    "env" "KpiEnvironment" NOT NULL,
    "date" DATE NOT NULL,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "windowEnd" TIMESTAMPTZ(3) NOT NULL,
    "calculationVersion" TEXT NOT NULL,
    "status" "KpiRunStatus" NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3),
    "errorCode" TEXT,

    CONSTRAINT "kpi_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_results" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "kpiId" TEXT NOT NULL,
    "status" "KpiResultStatus" NOT NULL,
    "value" DOUBLE PRECISION,
    "numerator" BIGINT,
    "denominator" BIGINT,
    "sampleCount" BIGINT,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "windowEnd" TIMESTAMPTZ(3) NOT NULL,
    "diagnosticCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_runs_env_date_idx" ON "kpi_runs"("env", "date");

-- CreateIndex
CREATE INDEX "kpi_results_kpiId_idx" ON "kpi_results"("kpiId");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_results_runId_kpiId_key" ON "kpi_results"("runId", "kpiId");

-- AddForeignKey
ALTER TABLE "kpi_results" ADD CONSTRAINT "kpi_results_runId_fkey" FOREIGN KEY ("runId") REFERENCES "kpi_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraints (not expressible in Prisma schema)
ALTER TABLE "kpi_runs" ADD CONSTRAINT "kpi_runs_window_check" CHECK ("windowStart" < "windowEnd");

ALTER TABLE "kpi_results" ADD CONSTRAINT "kpi_results_window_check" CHECK ("windowStart" < "windowEnd");

-- NaN = NaN is true in PostgreSQL, so NOT IN rejects NaN as well as both infinities.
ALTER TABLE "kpi_results" ADD CONSTRAINT "kpi_results_value_status_check" CHECK (
    ("status" = 'READY' AND "value" IS NOT NULL AND "value" NOT IN ('NaN', 'Infinity', '-Infinity'))
    OR ("status" <> 'READY' AND "value" IS NULL)
);

ALTER TABLE "kpi_results" ADD CONSTRAINT "kpi_results_counts_check" CHECK (
    ("numerator" IS NULL OR "numerator" >= 0)
    AND ("denominator" IS NULL OR "denominator" >= 0)
    AND ("sampleCount" IS NULL OR "sampleCount" >= 0)
);
