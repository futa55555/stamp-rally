import { IsJWT, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AppleLoginDto {
  @IsString()
  @IsJWT()
  @MaxLength(10_000)
  identityToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  nonce!: string;
}
