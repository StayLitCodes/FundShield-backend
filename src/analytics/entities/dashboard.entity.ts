import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("dashboards")
export class Dashboard {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  name: string

  @Column({ type: "text", nullable: true })
  description: string

  @Column({ type: "json" })
  widgets: Array<{
    id: string
    type: string
    title: string
    config: Record<string, any>
    position: { x: number; y: number; width: number; height: number }
  }>

  @Column({ type: "json", nullable: true })
  filters: Record<string, any>

  @Column({ type: "uuid" })
  createdBy: string

  @Column({ default: true })
  isActive: boolean

  @Column({ default: false })
  isPublic: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
