import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BullModule } from "@nestjs/bull"
import { ConfigModule } from "@nestjs/config"

// Entities
import { Escrow } from "./entities/escrow.entity"
import { EscrowMilestone } from "./entities/escrow-milestone.entity"
import { EscrowTransaction } from "./entities/escrow-transaction.entity"
import { EscrowParticipant } from "./entities/escrow-participant.entity"
import { EscrowCondition } from "./entities/escrow-condition.entity"
import { EscrowAuditLog } from "./entities/escrow-audit-log.entity"
import { EscrowTemplate } from "./entities/escrow-template.entity"
import { EscrowDispute } from "./entities/escrow-dispute.entity"
import { EscrowNotification } from "./entities/escrow-notification.entity"

// Services
import { EscrowService } from "./services/escrow.service"
import { EscrowStateService } from "./services/escrow-state.service"
import { MilestoneService } from "./services/milestone.service"
import { EscrowTransactionService } from "./services/escrow-transaction.service"
import { SmartContractService } from "./services/smart-contract.service"
import { EscrowNotificationService } from "./services/escrow-notification.service"
import { EscrowAuditService } from "./services/escrow-audit.service"
import { EscrowTemplateService } from "./services/escrow-template.service"
import { EscrowValidationService } from "./services/escrow-validation.service"
import { BulkEscrowService } from "./services/bulk-escrow.service"

// Controllers
import { EscrowController } from "./controllers/escrow.controller"
import { MilestoneController } from "./controllers/milestone.controller"
import { EscrowTemplateController } from "./controllers/escrow-template.controller"
import { EscrowAuditController } from "./controllers/escrow-audit.controller"
import { BulkEscrowController } from "./controllers/bulk-escrow.controller"

// Processors
import { EscrowProcessor } from "./processors/escrow.processor"
import { MilestoneProcessor } from "./processors/milestone.processor"
import { SmartContractProcessor } from "./processors/smart-contract.processor"

// Guards
import { EscrowOwnershipGuard } from "./guards/escrow-ownership.guard"
import { EscrowStateGuard } from "./guards/escrow-state.guard"

// Gateways
import { EscrowGateway } from "./gateways/escrow.gateway"

// Config
import { escrowConfig } from "./config/escrow.config"

@Module({
  imports: [
    ConfigModule.forFeature(escrowConfig),
    TypeOrmModule.forFeature([
      Escrow,
      EscrowMilestone,
      EscrowTransaction,
      EscrowParticipant,
      EscrowCondition,
      EscrowAuditLog,
      EscrowTemplate,
      EscrowDispute,
      EscrowNotification,
    ]),
    BullModule.registerQueue({ name: "escrow-queue" }, { name: "milestone-queue" }, { name: "smart-contract-queue" }),
  ],
  controllers: [
    EscrowController,
    MilestoneController,
    EscrowTemplateController,
    EscrowAuditController,
    BulkEscrowController,
  ],
  providers: [
    EscrowService,
    EscrowStateService,
    MilestoneService,
    EscrowTransactionService,
    SmartContractService,
    EscrowNotificationService,
    EscrowAuditService,
    EscrowTemplateService,
    EscrowValidationService,
    BulkEscrowService,
    EscrowProcessor,
    MilestoneProcessor,
    SmartContractProcessor,
    EscrowOwnershipGuard,
    EscrowStateGuard,
    EscrowGateway,
  ],
  exports: [EscrowService, EscrowStateService, MilestoneService, SmartContractService, EscrowNotificationService],
})
export class EscrowModule {}
