import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class SetVehiclePhotoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  photoPath: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2000)
  photoUrl: string;
}
