-- DropForeignKey
ALTER TABLE "MaintenanceAlertDelivery" DROP CONSTRAINT "MaintenanceAlertDelivery_scheduleId_fkey";

-- AlterTable
ALTER TABLE "MaintenanceAlertDelivery" ADD COLUMN     "cycleId" UUID;

-- CreateTable
CREATE TABLE "MaintenanceAlertCycle" (
    "id" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "dueKey" TEXT NOT NULL,
    "vehicleId" UUID NOT NULL,
    "normalizedType" TEXT NOT NULL,
    "dueDate" DATE,
    "dueMileage" INTEGER,
    "firstSentAt" TIMESTAMPTZ(3) NOT NULL,
    "mileageReachedAt" TIMESTAMPTZ(3),
    "resolvedMaintenanceId" UUID,
    "resolvedServiceDate" DATE,
    "resolvedServiceMileage" INTEGER,
    "resolvedAt" TIMESTAMPTZ(3),
    "canceledAt" TIMESTAMPTZ(3),
    "ruleVersion" TEXT NOT NULL,

    CONSTRAINT "MaintenanceAlertCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceAlertCycle_vehicleId_normalizedType_canceledAt_idx" ON "MaintenanceAlertCycle"("vehicleId", "normalizedType", "canceledAt");

-- CreateIndex
CREATE INDEX "MaintenanceAlertCycle_firstSentAt_canceledAt_idx" ON "MaintenanceAlertCycle"("firstSentAt", "canceledAt");

-- CreateIndex
CREATE INDEX "MaintenanceAlertCycle_dueDate_mileageReachedAt_idx" ON "MaintenanceAlertCycle"("dueDate", "mileageReachedAt");

-- CreateIndex
CREATE INDEX "MaintenanceAlertCycle_resolvedMaintenanceId_idx" ON "MaintenanceAlertCycle"("resolvedMaintenanceId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceAlertCycle_scheduleId_dueKey_key" ON "MaintenanceAlertCycle"("scheduleId", "dueKey");

-- CreateIndex
CREATE INDEX "MaintenanceAlertDelivery_cycleId_idx" ON "MaintenanceAlertDelivery"("cycleId");

-- AddForeignKey
ALTER TABLE "MaintenanceAlertDelivery" ADD CONSTRAINT "MaintenanceAlertDelivery_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "MaintenanceAlertCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
