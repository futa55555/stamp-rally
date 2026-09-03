import { Module } from '@nestjs/common';
import { AuthAccountRepository } from './auth-account.repository.js';

@Module({
  providers: [AuthAccountRepository],
  exports: [AuthAccountRepository],
})
export class AuthModule {}
