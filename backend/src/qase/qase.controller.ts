import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthGuard } from "../auth/auth.guard";
import { AuthContext } from "../auth/auth.service";
import { RequireCompany } from "../auth/company.decorator";
import { CompanyScopeGuard } from "../auth/company.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { EnvironmentService } from "../config/environment.service";
import { QaseService } from "./qase.service";

type RequestWithUser = Request & { user?: AuthContext };

@Controller()
@UseGuards(AuthGuard, CompanyScopeGuard, RolesGuard)
@RequireCompany({ query: "companyId" })
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
  @Roles("client_admin", "admin", "global_admin")
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

  // Supabase todos helpers
  @Get("todos-backend")
  async getTodosBackend() {
    return this.qaseService.getAllTodosFromSupabase();
  }

  @Post("todos-backend")
  @Roles("client_admin", "admin", "global_admin")
  async createTodoBackend(@Body() body: { text?: string }) {
    if (!body?.text || typeof body.text !== "string" || !body.text.trim()) {
      return { error: "Campo 'text' obrigatorio" };
    }
    return this.qaseService.createTodoInSupabase(body.text.trim());
  }

  @Post("todos-backend/delete")
  @Roles("client_admin", "admin", "global_admin")
  async deleteTodoBackend(@Body() body: { id?: number }) {
    if (!body?.id || typeof body.id !== "number") {
      return { error: "ID obrigatorio" };
    }
    return this.qaseService.deleteTodoInSupabase(body.id);
  }

  // Supabase countries helpers
  @Get("countries")
  async getAllCountries() {
    return this.qaseService.getAllCountriesFromSupabase();
  }

  @Get("countries/:id")
  async getCountryById(@Param("id") id: string) {
    return this.qaseService.getCountryByIdFromSupabase(Number(id));
  }

  @Post("countries")
  @Roles("client_admin", "admin", "global_admin")
  async createCountry(@Body() body: { name: string }) {
    return this.qaseService.createCountryInSupabase(body.name);
  }

  @Patch("countries/:id")
  @Roles("client_admin", "admin", "global_admin")
  async updateCountry(@Param("id") id: string, @Body() body: { name: string }) {
    return this.qaseService.updateCountryInSupabase(Number(id), body.name);
  }

  @Delete("countries/:id")
  @Roles("client_admin", "admin", "global_admin")
  async deleteCountry(@Param("id") id: string) {
    return this.qaseService.deleteCountryInSupabase(Number(id));
  }
}
