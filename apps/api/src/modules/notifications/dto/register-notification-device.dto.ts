import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RegisterNotificationDeviceDto {
  @IsUUID('4')
  installationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;
}
