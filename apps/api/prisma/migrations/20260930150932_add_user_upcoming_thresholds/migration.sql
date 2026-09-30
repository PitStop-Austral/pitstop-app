-- AlterTable
ALTER TABLE "User" ADD COLUMN     "upcomingThresholdDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "upcomingThresholdKm" INTEGER NOT NULL DEFAULT 1500;
