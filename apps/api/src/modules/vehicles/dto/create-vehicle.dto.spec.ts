import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { FuelType, TransmissionType } from '../../../generated/prisma/client';
import { CreateVehicleDto } from './create-vehicle.dto';

describe('CreateVehicleDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: CreateVehicleDto };
  const validVehicle = {
    brand: 'Honda',
    model: 'Civic',
    year: 2021,
    fuel: FuelType.NAFTA,
    plate: 'AF812KM',
    mileage: 48000,
  };

  it('normalizes a lowercase plate with display spacing', async () => {
    const result = await pipe.transform({ ...validVehicle, plate: 'af 812 km' }, metadata);

    expect(result.plate).toBe('AF812KM');
  });

  it('accepts every technical field empty', async () => {
    await expect(
      pipe.transform(
        {
          ...validVehicle,
          engineOilType: '',
          engineOilLiters: null,
          gearboxOilType: '',
          gearboxOilLiters: null,
          transmission: null,
          frontTireSize: '',
          frontTirePressurePsi: null,
          rearTireSize: '',
          rearTirePressurePsi: null,
          highBeam: '',
          lowBeam: '',
          fogLight: '',
        },
        metadata,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        engineOilType: '',
        engineOilLiters: null,
        transmission: null,
        frontTirePressurePsi: null,
      }),
    );
  });

  it('accepts and trims every technical field', async () => {
    const result = await pipe.transform(
      {
        ...validVehicle,
        engineOilType: ' 5W-30 sintético ',
        engineOilLiters: 4.2,
        gearboxOilType: ' ATF DW-1 ',
        gearboxOilLiters: 3.1,
        transmission: TransmissionType.MANUAL,
        frontTireSize: ' 215/50 R17 ',
        frontTirePressurePsi: 32,
        rearTireSize: ' 215/50 R17 ',
        rearTirePressurePsi: 30,
        highBeam: ' H11 ',
        lowBeam: ' H7 ',
        fogLight: ' H8 ',
      },
      metadata,
    );

    expect(result).toEqual(
      expect.objectContaining({
        engineOilType: '5W-30 sintético',
        engineOilLiters: 4.2,
        gearboxOilType: 'ATF DW-1',
        gearboxOilLiters: 3.1,
        transmission: TransmissionType.MANUAL,
        frontTireSize: '215/50 R17',
        frontTirePressurePsi: 32,
        rearTireSize: '215/50 R17',
        rearTirePressurePsi: 30,
        highBeam: 'H11',
        lowBeam: 'H7',
        fogLight: 'H8',
      }),
    );
  });

  it.each([
    ['an impossible year', { year: 1899 }],
    ['an invalid plate', { plate: 'ABC-123' }],
    ['a negative mileage', { mileage: -1 }],
    ['mileage above the database range', { mileage: 2_147_483_648 }],
    ['an empty brand', { brand: '  ' }],
    ['an empty model', { model: '' }],
  ])('rejects %s', async (_, invalidFields) => {
    await expect(pipe.transform({ ...validVehicle, ...invalidFields }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it.each([
    ['oil liters as text', { engineOilLiters: '4.2' }],
    ['negative oil liters', { engineOilLiters: -1 }],
    ['oil liters with excessive precision', { engineOilLiters: 4.222 }],
    ['oil liters outside the database range', { engineOilLiters: 100 }],
    ['tire pressure as text', { frontTirePressurePsi: '32' }],
    ['fractional tire pressure', { rearTirePressurePsi: 31.5 }],
    ['negative tire pressure', { frontTirePressurePsi: -1 }],
    ['an unknown transmission', { transmission: 'SECUENCIAL' }],
  ])('rejects %s', async (_, invalidFields) => {
    await expect(pipe.transform({ ...validVehicle, ...invalidFields }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });
});
