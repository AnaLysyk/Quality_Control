import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";

@Module({
  providers: [AuthService, AuthGuard],
  controllers: [AuthController],
  exports: [AuthGuard, AuthService],
})
export class AuthModule {}
