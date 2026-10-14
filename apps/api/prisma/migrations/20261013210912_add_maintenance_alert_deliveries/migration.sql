-- CreateEnum
CREATE TYPE "MaintenanceAlertDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "MaintenanceAlertDelivery" (
    "id" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "installationId" UUID NOT NULL,
    "notificationDeviceId" UUID,
    "dueKey" TEXT NOT NULL,
    "dueDate" DATE,
    "dueMileage" INTEGER,
    "status" "MaintenanceAlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "fcmMessageId" TEXT,
    "errorCode" TEXT,
    "attemptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "MaintenanceAlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaintenanceAlertDelivery_notificationDeviceId_idx" ON "MaintenanceAlertDelivery"("notificationDeviceId");

-- CreateIndex
CREATE INDEX "MaintenanceAlertDelivery_status_attemptedAt_idx" ON "MaintenanceAlertDelivery"("status", "attemptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceAlertDelivery_scheduleId_installationId_dueKey_key" ON "MaintenanceAlertDelivery"("scheduleId", "installationId", "dueKey");

-- AddForeignKey
ALTER TABLE "MaintenanceAlertDelivery" ADD CONSTRAINT "MaintenanceAlertDelivery_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceAlertDelivery" ADD CONSTRAINT "MaintenanceAlertDelivery_notificationDeviceId_fkey" FOREIGN KEY ("notificationDeviceId") REFERENCES "NotificationDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
