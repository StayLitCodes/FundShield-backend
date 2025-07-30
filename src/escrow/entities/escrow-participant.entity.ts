import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { ParticipantRole } from "../enums/participant-role.enum"
import { Escrow } from "./escrow.entity"

@Entity("escrow_participants")
@Index(["escrowId", "userId"])
export class EscrowParticipant {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  escrowId: string

  @Column({ type: "uuid" })
  userId: string

  @Column({ type: "enum", enum: ParticipantRole })
  role: ParticipantRole

  @Column({ type: "json", nullable: true })
  permissions: string[]

  @Column({ default: true })
  isActive: boolean

  @Column({ type: "timestamp", nullable: true })
  joinedAt: Date

  @Column({ type: "timestamp", nullable: true })
  leftAt: Date

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(
    () => Escrow,
    (escrow) => escrow.participants,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "escrowId" })
  escrow: Escrow
}
