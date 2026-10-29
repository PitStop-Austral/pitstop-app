-- CreateEnum
CREATE TYPE "WishlistPriority" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedPrice" DECIMAL(12,2),
    "priority" "WishlistPriority" NOT NULL DEFAULT 'MEDIA',
    "note" TEXT,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_vehicleId_purchased_priority_createdAt_idx" ON "WishlistItem"("vehicleId", "purchased", "priority", "createdAt");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraints (not expressible in Prisma schema)
ALTER TABLE "WishlistItem"
  ADD CONSTRAINT "WishlistItem_estimatedPrice_non_negative"
    CHECK ("estimatedPrice" IS NULL OR "estimatedPrice" >= 0),
  ADD CONSTRAINT "WishlistItem_name_not_blank"
    CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "WishlistItem_purchasedAt_matches_purchased"
    CHECK (("purchased" AND "purchasedAt" IS NOT NULL) OR (NOT "purchased" AND "purchasedAt" IS NULL));
