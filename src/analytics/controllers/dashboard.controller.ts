import { Controller, Post, Get, Put, Delete, Param } from "@nestjs/common"
import type { DashboardService } from "../services/dashboard.service"
import type { CreateDashboardDto, UpdateDashboardDto } from "../dto/dashboard.dto"

@Controller("dashboards")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Post()
  async createDashboard(createDashboardDto: CreateDashboardDto) {
    return this.dashboardService.createDashboard(createDashboardDto)
  }

  @Get()
  async getDashboards(userId?: string) {
    return this.dashboardService.getDashboards(userId)
  }

  @Get("user/:userId")
  async getUserDashboards(@Param("userId") userId: string) {
    return this.dashboardService.getUserDashboards(userId)
  }

  @Get(":id")
  async getDashboardById(@Param("id") id: string) {
    return this.dashboardService.getDashboardById(id)
  }

  @Get(":id/data")
  async getDashboardData(@Param("id") id: string, filters?: Record<string, any>) {
    return this.dashboardService.getDashboardData(id, filters)
  }

  @Put(":id")
  async updateDashboard(@Param("id") id: string, updateDashboardDto: UpdateDashboardDto) {
    return this.dashboardService.updateDashboard(id, updateDashboardDto)
  }

  @Delete(":id")
  async deleteDashboard(@Param("id") id: string) {
    return this.dashboardService.deleteDashboard(id)
  }
}
