import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, WishlistPriority } from '../../generated/prisma/client';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { WishlistRepository, WishlistItemView } from './wishlist.repository';
import { WishlistService } from './wishlist.service';

describe('WishlistService', () => {
  let service: WishlistService;
  let findOwnedById: jest.MockedFunction<VehiclesRepository['findOwnedById']>;
  let findManyByVehicle: jest.MockedFunction<WishlistRepository['findManyByVehicle']>;
  let findByVehicle: jest.MockedFunction<WishlistRepository['findByVehicle']>;
  let create: jest.MockedFunction<WishlistRepository['create']>;
  let setPurchased: jest.MockedFunction<WishlistRepository['setPurchased']>;
  let deleteItem: jest.MockedFunction<WishlistRepository['delete']>;

  const vehicleId = '22222222-2222-4222-8222-222222222222';
  const itemId = '33333333-3333-4333-8333-333333333333';
  const item: WishlistItemView = {
    id: itemId,
    vehicleId,
    name: 'Llantas',
    estimatedPrice: new Prisma.Decimal('480000.50'),
    priority: WishlistPriority.BAJA,
    note: null,
    purchased: false,
    purchasedAt: null,
    createdAt: new Date('2026-10-23T14:00:00.000Z'),
  };
  const ownedVehicle = { id: vehicleId, mileage: 48000, photoPath: null };
  const notFound = Object.assign(new Error('Record not found'), { code: 'P2025' });

  beforeEach(async () => {
    findOwnedById = jest.fn().mockResolvedValue(ownedVehicle);
    findManyByVehicle = jest.fn();
    findByVehicle = jest.fn();
    create = jest.fn();
    setPurchased = jest.fn();
    deleteItem = jest.fn();

    const module = await Test.createTestingModule({
      providers: [
        WishlistService,
        {
          provide: WishlistRepository,
          useValue: { findManyByVehicle, findByVehicle, create, setPurchased, delete: deleteItem },
        },
        { provide: VehiclesRepository, useValue: { findOwnedById } },
      ],
    }).compile();

    service = module.get(WishlistService);
  });

  it.each([
    ['listing', () => service.findByVehicle('user-1', vehicleId)],
    ['creating', () => service.create('user-1', vehicleId, { name: 'Llantas' })],
    ['marking', () => service.setPurchased('user-1', vehicleId, itemId, true)],
    ['deleting', () => service.remove('user-1', vehicleId, itemId)],
  ])('hides an unowned vehicle behind not found when %s', async (_, call) => {
    findOwnedById.mockResolvedValue(null);

    await expect(call()).rejects.toThrow(new NotFoundException('Vehículo no encontrado'));
    expect(findOwnedById).toHaveBeenCalledWith(vehicleId, 'user-1');
    expect(findManyByVehicle).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(setPurchased).not.toHaveBeenCalled();
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('returns the price as a number', async () => {
    findManyByVehicle.mockResolvedValue([item]);

    await expect(service.findByVehicle('user-1', vehicleId)).resolves.toEqual([
      { ...item, estimatedPrice: 480000.5 },
    ]);
  });

  it('defaults to medium priority and null optional fields', async () => {
    create.mockResolvedValue({ ...item, priority: WishlistPriority.MEDIA, estimatedPrice: null });

    await service.create('user-1', vehicleId, { name: ' Llantas ', note: '  ' });

    expect(create).toHaveBeenCalledWith(vehicleId, {
      name: 'Llantas',
      estimatedPrice: null,
      priority: WishlistPriority.MEDIA,
      note: null,
    });
  });

  it('sets the purchase date when marking as purchased', async () => {
    const purchasedAt = new Date('2026-10-24T10:00:00.000Z');
    findByVehicle.mockResolvedValue({ ...item, purchased: true, purchasedAt });

    await expect(service.setPurchased('user-1', vehicleId, itemId, true)).resolves.toMatchObject({
      purchased: true,
      purchasedAt,
    });
    expect(setPurchased).toHaveBeenCalledWith(vehicleId, itemId, true, expect.any(Date));
    expect(setPurchased.mock.invocationCallOrder[0]).toBeLessThan(
      findByVehicle.mock.invocationCallOrder[0],
    );
  });

  it('clears the purchase date when unmarking', async () => {
    findByVehicle.mockResolvedValue(item);

    await service.setPurchased('user-1', vehicleId, itemId, false);

    expect(setPurchased).toHaveBeenCalledWith(vehicleId, itemId, false, null);
  });

  it('returns the stored item when the conditional write matched nothing because it already had that state', async () => {
    const purchasedAt = new Date('2026-10-24T10:00:00.000Z');
    setPurchased.mockResolvedValue(undefined);
    findByVehicle.mockResolvedValue({ ...item, purchased: true, purchasedAt });

    await expect(service.setPurchased('user-1', vehicleId, itemId, true)).resolves.toMatchObject({
      purchased: true,
      purchasedAt,
    });
  });

  it('returns not found when the conditional write matched nothing and the item does not exist', async () => {
    setPurchased.mockResolvedValue(undefined);
    findByVehicle.mockResolvedValue(null);

    await expect(service.setPurchased('user-1', vehicleId, itemId, true)).rejects.toThrow(
      new NotFoundException('Deseo no encontrado'),
    );
  });

  it('maps a concurrently deleted item to not found on delete', async () => {
    deleteItem.mockRejectedValue(notFound);

    await expect(service.remove('user-1', vehicleId, itemId)).rejects.toThrow(
      new NotFoundException('Deseo no encontrado'),
    );
  });

  it('maps a vehicle deleted before the insert to vehicle not found', async () => {
    create.mockRejectedValue(
      Object.assign(new Error('Foreign key constraint violated'), { code: 'P2003' }),
    );

    await expect(service.create('user-1', vehicleId, { name: 'Llantas' })).rejects.toThrow(
      new NotFoundException('Vehículo no encontrado'),
    );
  });
});
