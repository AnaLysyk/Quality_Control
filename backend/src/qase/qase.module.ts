import { Module } from "@nestjs/common";
import { QaseService } from "./qase.service";
import { QaseController } from "./qase.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [QaseService],
  controllers: [QaseController],
})
export class QaseModule {}
