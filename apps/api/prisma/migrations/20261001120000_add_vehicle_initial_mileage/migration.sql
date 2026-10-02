-- Preserve the odometer at registration so a frequency can return to its original base.
ALTER TABLE "Vehicle" ADD COLUMN "initialMileage" INTEGER;
ALTER TABLE "Schedule" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
