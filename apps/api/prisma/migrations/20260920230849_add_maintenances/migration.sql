-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('MANTENIMIENTO', 'ARREGLO');

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "date" DATE NOT NULL,
    "mileage" INTEGER NOT NULL,
    "workshop" TEXT,
    "cost" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Maintenance_vehicleId_date_idx" ON "Maintenance"("vehicleId", "date");

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
