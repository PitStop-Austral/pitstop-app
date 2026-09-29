-- CreateTable
CREATE TABLE "Schedule" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "normalizedType" TEXT NOT NULL,
    "intervalMonths" INTEGER,
    "intervalKm" INTEGER,
    "baselineDate" DATE NOT NULL,
    "baselineMileage" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_vehicleId_normalizedType_key" ON "Schedule"("vehicleId", "normalizedType");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
