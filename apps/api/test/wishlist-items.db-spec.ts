import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

describe('Wishlist items (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let userId: string | undefined;
  let vehicleId: string;
  const firebaseUid = `wishlist-test-${randomUUID()}`;
  const email = `${firebaseUid}@example.com`;

  function createVehicle(plate: string) {
    return prisma.vehicle.create({
      data: {
        ownerId: userId!,
        brand: 'Honda',
        model: 'Civic',
        year: 2021,
        fuel: 'NAFTA',
        plate,
        mileage: 48000,
      },
    });
  }

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl || !new URL(databaseUrl).pathname.slice(1).endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated PostgreSQL database ending in _test',
      );
    }

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    await prisma.$connect();

    const user = await prisma.user.create({
      data: { firebaseUid, email, name: 'Wishlist Test Driver' },
    });
    userId = user.id;
    vehicleId = (await createVehicle('AF812KM')).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    // Vehicles cascade to their wishlist items.
    if (userId) {
      await prisma.vehicle.deleteMany({ where: { ownerId: userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it('defaults to medium priority and not purchased', async () => {
    const item = await prisma.wishlistItem.create({ data: { vehicleId, name: 'Llantas' } });

    expect(item.priority).toBe('MEDIA');
    expect(item.purchased).toBe(false);
    expect(item.purchasedAt).toBeNull();
  });

  it('rejects a negative estimated price and accepts zero, null and exact decimals', async () => {
    await expect(
      prisma.wishlistItem.create({ data: { vehicleId, name: 'Negativo', estimatedPrice: -1 } }),
    ).rejects.toThrow('WishlistItem_estimatedPrice_non_negative');

    const zero = await prisma.wishlistItem.create({
      data: { vehicleId, name: 'Gratis', estimatedPrice: 0 },
    });
    expect(zero.estimatedPrice?.toString()).toBe('0');

    const unpriced = await prisma.wishlistItem.create({
      data: { vehicleId, name: 'Sin precio', estimatedPrice: null },
    });
    expect(unpriced.estimatedPrice).toBeNull();

    const exact = await prisma.wishlistItem.create({
      data: { vehicleId, name: 'Cubre asientos', estimatedPrice: '1234.56' },
    });
    const stored = await prisma.wishlistItem.findUniqueOrThrow({ where: { id: exact.id } });
    expect(stored.estimatedPrice?.toString()).toBe('1234.56');
  });

  it('rejects a blank name', async () => {
    await expect(prisma.wishlistItem.create({ data: { vehicleId, name: '   ' } })).rejects.toThrow(
      'WishlistItem_name_not_blank',
    );
  });

  it('rejects purchased without purchasedAt', async () => {
    await expect(
      prisma.wishlistItem.create({ data: { vehicleId, name: 'Comprado', purchased: true } }),
    ).rejects.toThrow('WishlistItem_purchasedAt_matches_purchased');
  });

  it('rejects purchasedAt on an item that is not purchased', async () => {
    await expect(
      prisma.wishlistItem.create({
        data: { vehicleId, name: 'Pendiente', purchased: false, purchasedAt: new Date() },
      }),
    ).rejects.toThrow('WishlistItem_purchasedAt_matches_purchased');
  });

  it('accepts a purchased item with purchasedAt', async () => {
    const purchasedAt = new Date('2026-10-20T15:00:00.000Z');
    const item = await prisma.wishlistItem.create({
      data: { vehicleId, name: 'Comprado', purchased: true, purchasedAt },
    });

    expect(item.purchased).toBe(true);
    expect(item.purchasedAt).toEqual(purchasedAt);
  });

  it('rejects an unknown vehicle', async () => {
    await expect(
      prisma.wishlistItem.create({ data: { vehicleId: randomUUID(), name: 'Huérfano' } }),
    ).rejects.toThrow('WishlistItem_vehicleId_fkey');
  });

  it('deletes the wishlist items when the vehicle is deleted', async () => {
    const vehicle = await createVehicle('AB123CD');
    await prisma.wishlistItem.createMany({
      data: [
        { vehicleId: vehicle.id, name: 'Llantas' },
        { vehicleId: vehicle.id, name: 'Cubre asientos' },
      ],
    });
    expect(await prisma.wishlistItem.count({ where: { vehicleId: vehicle.id } })).toBe(2);

    await prisma.vehicle.delete({ where: { id: vehicle.id } });

    expect(await prisma.wishlistItem.count({ where: { vehicleId: vehicle.id } })).toBe(0);
  });
});
