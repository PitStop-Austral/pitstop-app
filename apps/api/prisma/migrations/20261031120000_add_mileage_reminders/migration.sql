-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "mileageUpdatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill the most recent known vehicle activity for existing rows.
UPDATE "Vehicle" SET "mileageUpdatedAt" = "updatedAt";

-- CreateTable
CREATE TABLE "MileageReminderDelivery" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "installationId" UUID NOT NULL,
    "notificationDeviceId" UUID,
    "periodKey" TEXT NOT NULL,
    "status" "MaintenanceAlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "fcmMessageId" TEXT,
    "errorCode" TEXT,
    "attemptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "MileageReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MileageReminderDelivery_notificationDeviceId_idx" ON "MileageReminderDelivery"("notificationDeviceId");

-- CreateIndex
CREATE INDEX "MileageReminderDelivery_status_attemptedAt_idx" ON "MileageReminderDelivery"("status", "attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MileageReminderDelivery_vehicleId_installationId_periodKey_key" ON "MileageReminderDelivery"("vehicleId", "installationId", "periodKey");

-- AddForeignKey
ALTER TABLE "MileageReminderDelivery" ADD CONSTRAINT "MileageReminderDelivery_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MileageReminderDelivery" ADD CONSTRAINT "MileageReminderDelivery_notificationDeviceId_fkey" FOREIGN KEY ("notificationDeviceId") REFERENCES "NotificationDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
