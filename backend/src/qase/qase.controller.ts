import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { QaseService } from "./qase.service";
import { EnvironmentService } from "../config/environment.service";

@Controller()
@UseGuards(AuthGuard)
export class QaseController {
  constructor(private readonly qaseService: QaseService, private readonly env: EnvironmentService) {}

  private resolveProject(project?: string) {
    return project || this.env.getQaseDefaultProject() || "";
  }

  @Get("projects")
  getProjects() {
    return this.qaseService.getProjects();
  }

  @Get("runs")
  getRuns(@Query("project") project?: string) {
    return this.qaseService.getRuns(project);
  }

  @Post("runs")
  createRun(
    @Body() body: { project?: string; title?: string; description?: string; custom_type?: string },
    @Query("project") projectFromQuery?: string,
  ) {
    const project = body?.project || projectFromQuery || undefined;
    return this.qaseService.createRun({
      project,
      title: body?.title,
      description: body?.description,
      custom_type: body?.custom_type,
    });
  }

  @Get("runs/:id")
  getRunDetail(@Param("id") id: string, @Query("project") project?: string) {
    const projectCode = this.resolveProject(project);
    return this.qaseService.getRunDetail(projectCode, Number(id));
  }

  @Get("runs/:id/cases")
  getRunCases(@Param("id") id: string, @Query("project") project?: string) {
    const projectCode = this.resolveProject(project);
    return this.qaseService.getRunCases(projectCode, Number(id));
  }

  @Get("defects")
  getDefects(@Query("project") project?: string) {
    return this.qaseService.getDefects(project);
  }
}
