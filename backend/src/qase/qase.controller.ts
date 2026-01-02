import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { QaseService } from "./qase.service";

@Controller()
@UseGuards(AuthGuard)
export class QaseController {
  constructor(private readonly qaseService: QaseService) {}

  @Get("projects")
  getProjects() {
    return this.qaseService.getProjects();
  }

  @Get("runs")
  getRuns(@Query("project") project?: string) {
    return this.qaseService.getRuns(project);
  }

  @Get("runs/:id")
  getRunDetail(@Param("id") id: string, @Query("project") project?: string) {
    const projectCode = project || process.env.QASE_DEFAULT_PROJECT || "";
    return this.qaseService.getRunDetail(projectCode, Number(id));
  }

  @Get("runs/:id/cases")
  getRunCases(@Param("id") id: string, @Query("project") project?: string) {
    const projectCode = project || process.env.QASE_DEFAULT_PROJECT || "";
    return this.qaseService.getRunCases(projectCode, Number(id));
  }
}
