import { IsString, Matches } from 'class-validator';

export class RefreshSessionDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, {
    message: 'refreshToken must be a valid refresh token',
  })
  refreshToken!: string;
}
