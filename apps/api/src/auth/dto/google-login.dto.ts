import { IsJWT, IsString, MaxLength } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsJWT()
  @MaxLength(10_000)
  idToken!: string;
}
