-- CreateEnum
CREATE TYPE "TransmissionType" AS ENUM ('MANUAL', 'AUTOMATICA', 'CVT', 'DOBLE_EMBRAGUE', 'OTRO');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "engineOilLiters" DECIMAL(4,2),
ADD COLUMN     "engineOilType" TEXT,
ADD COLUMN     "fogLight" TEXT,
ADD COLUMN     "frontTirePressurePsi" INTEGER,
ADD COLUMN     "frontTireSize" TEXT,
ADD COLUMN     "gearboxOilLiters" DECIMAL(4,2),
ADD COLUMN     "gearboxOilType" TEXT,
ADD COLUMN     "highBeam" TEXT,
ADD COLUMN     "lowBeam" TEXT,
ADD COLUMN     "rearTirePressurePsi" INTEGER,
ADD COLUMN     "rearTireSize" TEXT,
ADD COLUMN     "transmission" "TransmissionType";
