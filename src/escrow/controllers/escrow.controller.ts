import { Controller, Post, Get, Put, Param, Body, Query, UseGuards } from "@nestjs/common"
import type { EscrowService } from "../services/escrow.service"
import type { CreateEscrowDto } from "../dto/create-escrow.dto"
import type { UpdateEscrowDto } from "../dto/update-escrow.dto"
import type { EscrowQueryDto } from "../dto/escrow-query.dto"
import { EscrowOwnershipGuard } from "../guards/escrow-ownership.guard"
import { EscrowStateGuard } from "../guards/escrow-state.guard"

@Controller("escrows")
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  async createEscrow(@Body() createEscrowDto: CreateEscrowDto, createdBy: string) {
    return this.escrowService.createEscrow(createEscrowDto, createdBy)
  }

  @Get()
  async getEscrows(@Query() query: EscrowQueryDto) {
    return this.escrowService.getEscrows(query)
  }

  @Get("statistics")
  async getEscrowStatistics(userId?: string) {
    return this.escrowService.getEscrowStatistics(userId)
  }

  @Get(":id")
  async getEscrowById(@Param("id") id: string) {
    return this.escrowService.getEscrowById(id)
  }

  @Get("number/:escrowNumber")
  async getEscrowByNumber(@Param("escrowNumber") escrowNumber: string) {
    return this.escrowService.getEscrowByNumber(escrowNumber)
  }

  @Put(":id")
  @UseGuards(EscrowOwnershipGuard)
  async updateEscrow(@Param("id") id: string, @Body() updateEscrowDto: UpdateEscrowDto, updatedBy: string) {
    return this.escrowService.updateEscrow(id, updateEscrowDto, updatedBy)
  }

  @Post(":id/fund")
  @UseGuards(EscrowStateGuard)
  async fundEscrow(@Param("id") id: string, fundedBy: string, @Body() transactionData?: any) {
    return this.escrowService.fundEscrow(id, fundedBy, transactionData)
  }

  @Post(":id/release")
  @UseGuards(EscrowOwnershipGuard, EscrowStateGuard)
  async releaseEscrowFunds(@Param("id") id: string, releasedBy: string, @Body("amount") amount?: number) {
    return this.escrowService.releaseEscrowFunds(id, releasedBy, amount)
  }

  @Post(":id/cancel")
  @UseGuards(EscrowOwnershipGuard)
  async cancelEscrow(@Param("id") id: string, cancelledBy: string, @Body("reason") reason?: string) {
    return this.escrowService.cancelEscrow(id, cancelledBy, reason)
  }

  @Get(":id/history")
  async getEscrowHistory(@Param("id") id: string) {
    return this.escrowService.getEscrowHistory(id)
  }
}
