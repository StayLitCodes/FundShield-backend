import { Controller, Post, Get, Put, Param, Body, UseGuards } from "@nestjs/common"
import type { MilestoneService } from "../services/milestone.service"
import type {
  CreateMilestoneDto,
  UpdateMilestoneDto,
  ApproveMilestoneDto,
  RejectMilestoneDto,
} from "../dto/milestone.dto"
import { EscrowOwnershipGuard } from "../guards/escrow-ownership.guard"

@Controller("milestones")
export class MilestoneController {
  constructor(private readonly milestoneService: MilestoneService) {}

  @Post()
  async createMilestone(@Body() createMilestoneDto: CreateMilestoneDto, createdBy: string) {
    return this.milestoneService.createMilestone(createMilestoneDto, createdBy)
  }

  @Get("escrow/:escrowId")
  async getEscrowMilestones(@Param("escrowId") escrowId: string) {
    return this.milestoneService.getEscrowMilestones(escrowId)
  }

  @Get("escrow/:escrowId/progress")
  async getMilestoneProgress(@Param("escrowId") escrowId: string) {
    return this.milestoneService.getMilestoneProgress(escrowId)
  }

  @Get(":id")
  async getMilestoneById(@Param("id") id: string) {
    return this.milestoneService.getMilestoneById(id)
  }

  @Put(":id")
  @UseGuards(EscrowOwnershipGuard)
  async updateMilestone(@Param("id") id: string, @Body() updateMilestoneDto: UpdateMilestoneDto, updatedBy: string) {
    return this.milestoneService.updateMilestone(id, updateMilestoneDto, updatedBy)
  }

  @Post(":id/start")
  @UseGuards(EscrowOwnershipGuard)
  async startMilestone(@Param("id") id: string, startedBy: string) {
    return this.milestoneService.startMilestone(id, startedBy)
  }

  @Post(":id/submit")
  @UseGuards(EscrowOwnershipGuard)
  async submitMilestone(@Param("id") id: string, submittedBy: string, @Body("deliverables") deliverables?: any[]) {
    return this.milestoneService.submitMilestone(id, submittedBy, deliverables)
  }

  @Post(":id/approve")
  @UseGuards(EscrowOwnershipGuard)
  async approveMilestone(
    @Param("id") id: string,
    @Body() approveMilestoneDto: ApproveMilestoneDto,
    approvedBy: string,
  ) {
    return this.milestoneService.approveMilestone(id, approveMilestoneDto, approvedBy)
  }

  @Post(":id/reject")
  @UseGuards(EscrowOwnershipGuard)
  async rejectMilestone(@Param("id") id: string, @Body() rejectMilestoneDto: RejectMilestoneDto, rejectedBy: string) {
    return this.milestoneService.rejectMilestone(id, rejectMilestoneDto, rejectedBy)
  }

  @Put(":milestoneId/requirements/:requirementId")
  @UseGuards(EscrowOwnershipGuard)
  async updateRequirement(
    @Param("milestoneId") milestoneId: string,
    @Param("requirementId") requirementId: string,
    @Body("completed") completed: boolean,
    completedBy?: string,
  ) {
    return this.milestoneService.updateRequirement(milestoneId, requirementId, completed, completedBy)
  }
}
