import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { TransmissionType } from '../../../generated/prisma/client';
import { UpdateVehicleDto } from './update-vehicle.dto';

describe('UpdateVehicleDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = { type: 'body' as const, metatype: UpdateVehicleDto };

  it('allows omitted fields and an explicitly cleared nickname', async () => {
    await expect(pipe.transform({}, metadata)).resolves.toEqual({});
    await expect(pipe.transform({ nickname: null }, metadata)).resolves.toEqual({ nickname: null });
  });

  it('allows every technical field to be cleared', async () => {
    const input = {
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
    };

    await expect(pipe.transform(input, metadata)).resolves.toEqual(input);
  });

  it('accepts every technical field', async () => {
    const input = {
      engineOilType: '5W-30 sintético',
      engineOilLiters: 4.2,
      gearboxOilType: 'ATF DW-1',
      gearboxOilLiters: 3.1,
      transmission: TransmissionType.CVT,
      frontTireSize: '215/50 R17',
      frontTirePressurePsi: 32,
      rearTireSize: '215/50 R17',
      rearTirePressurePsi: 30,
      highBeam: 'H11',
      lowBeam: 'H7',
      fogLight: 'H8',
    };

    await expect(pipe.transform(input, metadata)).resolves.toEqual(input);
  });

  it.each(['brand', 'model', 'year', 'fuel', 'plate', 'mileage'])(
    'rejects null for the required %s field',
    async (field) => {
      await expect(pipe.transform({ [field]: null }, metadata)).rejects.toThrow(
        BadRequestException,
      );
    },
  );

  it.each([
    ['oil liters as text', { engineOilLiters: '4.2' }],
    ['oil liters with excessive precision', { gearboxOilLiters: 3.123 }],
    ['negative tire pressure', { frontTirePressurePsi: -1 }],
    ['fractional tire pressure', { rearTirePressurePsi: 30.5 }],
    ['an unknown transmission', { transmission: 'SECUENCIAL' }],
  ])('rejects %s', async (_, input) => {
    await expect(pipe.transform(input, metadata)).rejects.toThrow(BadRequestException);
  });
});
