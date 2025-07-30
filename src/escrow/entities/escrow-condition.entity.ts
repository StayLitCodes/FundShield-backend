import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm"
import { ConditionType } from "../enums/condition-type.enum"
import { ConditionStatus } from "../enums/condition-status.enum"
import { Escrow } from "./escrow.entity"

@Entity("escrow_conditions")
export class EscrowCondition {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  escrowId: string

  @Column({ type: "enum", enum: ConditionType })
  type: ConditionType

  @Column()
  name: string

  @Column({ type: "text" })
  description: string

  @Column({ type: "enum", enum: ConditionStatus, default: ConditionStatus.PENDING })
  status: ConditionStatus

  @Column({ type: "json" })
  parameters: Record<string, any>

  @Column({ type: "json", nullable: true })
  result: Record<string, any>

  @Column({ default: false })
  isRequired: boolean

  @Column({ type: "int", default: 0 })
  order: number

  @Column({ type: "timestamp", nullable: true })
  evaluatedAt: Date

  @Column({ type: "uuid", nullable: true })
  evaluatedBy: string

  @Column({ type: "text", nullable: true })
  evaluationNotes: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(
    () => Escrow,
    (escrow) => escrow.conditions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "escrowId" })
  escrow: Escrow
}
