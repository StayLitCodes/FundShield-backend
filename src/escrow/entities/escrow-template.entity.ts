import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { EscrowType } from "../enums/escrow-type.enum"
import { Escrow } from "./escrow.entity"

@Entity("escrow_templates")
export class EscrowTemplate {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  name: string

  @Column({ type: "text", nullable: true })
  description: string

  @Column({ type: "enum", enum: EscrowType })
  type: EscrowType

  @Column({ type: "json" })
  defaultTerms: Record<string, any>

  @Column({ type: "json", nullable: true })
  milestoneTemplate: Array<{
    title: string
    description: string
    percentage: number
    requirements: string[]
    autoApprove: boolean
    autoApproveDelayHours: number
  }>

  @Column({ type: "json", nullable: true })
  conditionTemplates: Array<{
    type: string
    name: string
    description: string
    parameters: Record<string, any>
    isRequired: boolean
  }>

  @Column({ type: "decimal", precision: 5, scale: 4, default: 0.025 })
  defaultFeePercentage: number

  @Column({ default: false })
  isMultiMilestone: boolean

  @Column({ default: false })
  autoRelease: boolean

  @Column({ type: "int", default: 0 })
  autoReleaseDelayHours: number

  @Column({ default: true })
  isActive: boolean

  @Column({ type: "uuid" })
  createdBy: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(
    () => Escrow,
    (escrow) => escrow.template,
  )
  escrows: Escrow[]
}
