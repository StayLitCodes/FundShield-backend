import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets"
import type { Server, Socket } from "socket.io"
import { Logger } from "@nestjs/common"

interface NotificationPayload {
  id: string
  type: string
  title: string
  content: string
  data?: Record<string, any>
  createdAt: Date
}

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/notifications",
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(NotificationGateway.name)
  private userSockets = new Map<string, Set<string>>() // userId -> Set of socketIds

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)

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

  handleJoin(data: { userId: string }, client: Socket) {
    const { userId } = data

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }

    this.userSockets.get(userId)!.add(client.id)
    client.join(`user:${userId}`)

    this.logger.log(`User ${userId} joined with socket ${client.id}`)

    return { status: "joined", userId }
  }

  handleLeave(data: { userId: string }, client: Socket) {
    const { userId } = data

    client.leave(`user:${userId}`)

    const socketIds = this.userSockets.get(userId)
    if (socketIds) {
      socketIds.delete(client.id)
      if (socketIds.size === 0) {
        this.userSockets.delete(userId)
      }
    }

    this.logger.log(`User ${userId} left with socket ${client.id}`)

    return { status: "left", userId }
  }

  async sendNotificationToUser(userId: string, notification: NotificationPayload): Promise<void> {
    const room = `user:${userId}`
    this.server.to(room).emit("notification", notification)

    this.logger.log(`Notification sent to user ${userId}: ${notification.title}`)
  }

  async sendNotificationToAll(notification: NotificationPayload): Promise<void> {
    this.server.emit("notification", notification)
    this.logger.log(`Broadcast notification sent: ${notification.title}`)
  }

  getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys())
  }

  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0
  }
}
