-- CreateTable
CREATE TABLE "MileageReading" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "mileage" INTEGER NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MileageReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MileageReading_vehicleId_recordedAt_idx" ON "MileageReading"("vehicleId", "recordedAt");

-- AddForeignKey
ALTER TABLE "MileageReading" ADD CONSTRAINT "MileageReading_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one reading per vehicle with its current km, dated at its last "Actualizar km".
-- Skipped when the current km already matches initialMileage or a maintenance's km: maintenances
-- raise Vehicle.mileage without touching mileageUpdatedAt, so copying it would date those km too
-- early and hide the real maintenance point (it would no longer beat the running max). Those km
-- are already in the history with their correct date.
INSERT INTO "MileageReading" ("id", "vehicleId", "mileage", "recordedAt", "createdAt")
SELECT gen_random_uuid(), v."id", v."mileage", v."mileageUpdatedAt", now()
FROM "Vehicle" v
WHERE v."mileage" IS DISTINCT FROM v."initialMileage"
  AND NOT EXISTS (
    SELECT 1 FROM "Maintenance" m WHERE m."vehicleId" = v."id" AND m."mileage" = v."mileage"
  );
