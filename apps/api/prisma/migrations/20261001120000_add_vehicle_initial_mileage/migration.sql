-- Preserve the odometer at registration so a frequency can return to its original base.
ALTER TABLE "Vehicle" ADD COLUMN "initialMileage" INTEGER;
