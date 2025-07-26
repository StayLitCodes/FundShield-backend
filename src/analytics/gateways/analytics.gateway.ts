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
  namespace: "/analytics",
})
export class AnalyticsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(AnalyticsGateway.name)
  private connectedClients = new Set<string>()

  handleConnection(client: Socket) {
    this.connectedClients.add(client.id)
    this.logger.log(`Analytics client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id)
    this.logger.log(`Analytics client disconnected: ${client.id}`)
  }

  async broadcastMetricUpdate(metric: {
    type: string
    name: string
    value: number
    timestamp: Date
    metadata?: Record<string, any>
  }): Promise<void> {
    this.server.emit("metric-update", metric)
    this.logger.debug(`Broadcasted metric update: ${metric.name}`)
  }

  async broadcastKpiUpdate(kpi: {
    name: string
    value: number
    target?: number
    variance?: number
    category: string
    timestamp: Date
  }): Promise<void> {
    this.server.emit("kpi-update", kpi)
    this.logger.debug(`Broadcasted KPI update: ${kpi.name}`)
  }

  async broadcastDashboardUpdate(dashboardId: string, data: Record<string, any>): Promise<void> {
    this.server.to(`dashboard:${dashboardId}`).emit("dashboard-update", data)
    this.logger.debug(`Broadcasted dashboard update: ${dashboardId}`)
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size
  }
}
