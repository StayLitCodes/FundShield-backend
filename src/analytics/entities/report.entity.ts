import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { ReportType } from "../enums/report-type.enum"
import { ReportStatus } from "../enums/report-status.enum"

@Entity("reports")
export class Report {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  name: string

  @Column({ type: "enum", enum: ReportType })
  type: ReportType

  @Column({ type: "enum", enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus

  @Column({ type: "json" })
  parameters: Record<string, any>

  @Column({ type: "json", nullable: true })
  data: Record<string, any>

  @Column({ nullable: true })
  filePath: string

  @Column({ nullable: true })
  format: string

  @Column({ type: "uuid" })
  createdBy: string

  @Column({ type: "timestamp", nullable: true })
  scheduledAt: Date

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date

  @Column({ type: "text", nullable: true })
  errorMessage: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
