import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { AuthContext } from "../auth/auth.service";
import { QaseService } from "./qase.service";
import { EnvironmentService } from "../config/environment.service";

type RequestWithUser = Request & { user?: AuthContext };

@Controller()
@UseGuards(AuthGuard)
export class QaseController {
  constructor(private readonly qaseService: QaseService, private readonly env: EnvironmentService) {}

  private resolveProject(project?: string) {
    return project || this.env.getQaseDefaultProject() || "";
  }

  private resolveCompanyId(req: RequestWithUser, override?: string) {
    const user = req.user;
    if (user?.isGlobalAdmin && typeof override === "string" && override.trim()) {
      return override.trim();
    }
    if (!user) return undefined;
    return user.companyId ?? user.clientId;
  }

  @Get("projects")
  getProjects(@Req() req: RequestWithUser, @Query("companyId") companyId?: string) {
    const resolved = this.resolveCompanyId(req, companyId);
    return this.qaseService.getProjects(resolved);
  }

  @Get("runs")
  getRuns(@Req() req: RequestWithUser, @Query("project") project?: string, @Query("companyId") companyId?: string) {
    const resolved = this.resolveCompanyId(req, companyId);
    return this.qaseService.getRuns(resolved, project);
  }

  @Post("runs")
  createRun(
    @Req() req: RequestWithUser,
    @Body() body: { project?: string; title?: string; description?: string; custom_type?: string },
    @Query("project") projectFromQuery?: string,
    @Query("companyId") companyId?: string,
  ) {
    const resolved = this.resolveCompanyId(req, companyId);
    const project = body?.project || projectFromQuery || undefined;
    return this.qaseService.createRun(resolved, {
      project,
      title: body?.title,
      description: body?.description,
      custom_type: body?.custom_type,
    });
  }

  @Get("runs/:id")
  getRunDetail(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Query("project") project?: string,
    @Query("companyId") companyId?: string,
  ) {
    const projectCode = this.resolveProject(project);
    const resolved = this.resolveCompanyId(req, companyId);
    return this.qaseService.getRunDetail(projectCode, Number(id), resolved);
  }

  @Get("runs/:id/cases")
  getRunCases(
    @Req() req: RequestWithUser,
    @Param("id") id: string,
    @Query("project") project?: string,
    @Query("companyId") companyId?: string,
  ) {
    const projectCode = this.resolveProject(project);
    const resolved = this.resolveCompanyId(req, companyId);
    return this.qaseService.getRunCases(projectCode, Number(id), resolved);
  }

  @Get("defects")
  getDefects(@Req() req: RequestWithUser, @Query("project") project?: string, @Query("companyId") companyId?: string) {
    const resolved = this.resolveCompanyId(req, companyId);
    return this.qaseService.getDefects(resolved, project);
  }
}
