-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('NAFTA', 'DIESEL', 'GNC', 'HIBRIDO', 'ELECTRICO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeVehicleId" UUID;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "fuel" "FuelType",
ADD COLUMN     "mileage" INTEGER,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "plate" TEXT,
ADD COLUMN     "year" INTEGER;

-- Backfill any pre-feature rows before enforcing the new required fields.
UPDATE "Vehicle"
SET "brand" = 'Sin datos',
    "fuel" = 'NAFTA',
    "mileage" = 0,
    "model" = 'Sin datos',
    "plate" = 'LEGACY-' || "id"::text,
    "year" = 1900;

-- AlterTable
ALTER TABLE "Vehicle" ALTER COLUMN "brand" SET NOT NULL,
ALTER COLUMN "fuel" SET NOT NULL,
ALTER COLUMN "mileage" SET NOT NULL,
ALTER COLUMN "model" SET NOT NULL,
ALTER COLUMN "plate" SET NOT NULL,
ALTER COLUMN "year" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_ownerId_plate_key" ON "Vehicle"("ownerId", "plate");
