import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets"
import type { Server, Socket } from "socket.io"
import { Logger } from "@nestjs/common"

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/escrow",
})
export class EscrowGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(EscrowGateway.name)
  private userSockets = new Map<string, Set<string>>() // userId -> Set of socketIds

  handleConnection(client: Socket) {
    this.logger.log(`Escrow client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Escrow client disconnected: ${client.id}`)

    // Remove socket from user mapping
    for (const [userId, socketIds] of this.userSockets.entries()) {
      if (socketIds.has(client.id)) {
        socketIds.delete(client.id)
        if (socketIds.size === 0) {
          this.userSockets.delete(userId)
        }
        break
      }
    }
  }

  handleJoinEscrow(data: { userId: string; escrowId: string }, client: Socket) {
    const { userId, escrowId } = data

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }

    this.userSockets.get(userId)!.add(client.id)
    client.join(`escrow:${escrowId}`)
    client.join(`user:${userId}`)

    this.logger.log(`User ${userId} joined escrow ${escrowId} with socket ${client.id}`)

    return { status: "joined", escrowId, userId }
  }

  handleLeaveEscrow(data: { userId: string; escrowId: string }, client: Socket) {
    const { userId, escrowId } = data

    client.leave(`escrow:${escrowId}`)
    client.leave(`user:${userId}`)

    const socketIds = this.userSockets.get(userId)
    if (socketIds) {
      socketIds.delete(client.id)
      if (socketIds.size === 0) {
        this.userSockets.delete(userId)
      }
    }

    this.logger.log(`User ${userId} left escrow ${escrowId} with socket ${client.id}`)

    return { status: "left", escrowId, userId }
  }

  async sendEscrowUpdate(
    escrowId: string,
    update: {
      type: string
      data: Record<string, any>
      timestamp: Date
    },
  ): Promise<void> {
    const room = `escrow:${escrowId}`
    this.server.to(room).emit("escrow-update", update)

    this.logger.log(`Escrow update sent to room ${room}: ${update.type}`)
  }

  async sendMilestoneUpdate(
    escrowId: string,
    milestoneUpdate: {
      milestoneId: string
      type: string
      data: Record<string, any>
      timestamp: Date
    },
  ): Promise<void> {
    const room = `escrow:${escrowId}`
    this.server.to(room).emit("milestone-update", milestoneUpdate)

    this.logger.log(`Milestone update sent to escrow ${escrowId}: ${milestoneUpdate.type}`)
  }

  async sendNotificationToUser(
    userId: string,
    notification: {
      id: string
      type: string
      title: string
      message: string
      data: Record<string, any>
      createdAt: Date
    },
  ): Promise<void> {
    const room = `user:${userId}`
    this.server.to(room).emit("notification", notification)

    this.logger.log(`Notification sent to user ${userId}: ${notification.title}`)
  }

  async broadcastSystemMessage(message: {
    type: string
    title: string
    content: string
    timestamp: Date
  }): Promise<void> {
    this.server.emit("system-message", message)
    this.logger.log(`System message broadcasted: ${message.title}`)
  }

  getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys())
  }

  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0
  }

  getEscrowParticipants(escrowId: string): number {
    return this.server.sockets.adapter.rooms.get(`escrow:${escrowId}`)?.size || 0
  }
}
