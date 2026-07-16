import { Module } from '@nestjs/common';
import { GitHubAuthController } from './github-auth.controller';

@Module({
  controllers: [GitHubAuthController],
})
export class AuthModule {}
