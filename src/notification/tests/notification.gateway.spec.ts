import { Test, type TestingModule } from "@nestjs/testing"
import { NotificationGateway } from "../gateways/notification.gateway"
import type { Socket } from "socket.io"
import { jest } from "@jest/globals"

describe("NotificationGateway", () => {
  let gateway: NotificationGateway

  const mockSocket = {
    id: "socket-123",
    join: jest.fn(),
    leave: jest.fn(),
  } as unknown as Socket

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationGateway],
    }).compile()

    gateway = module.get<NotificationGateway>(NotificationGateway)
    gateway.server = mockServer as any
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("handleJoin", () => {
    it("should handle user joining", () => {
      const data = { userId: "user-123" }

      const result = gateway.handleJoin(data, mockSocket)

      expect(mockSocket.join).toHaveBeenCalledWith("user:user-123")
      expect(result).toEqual({ status: "joined", userId: "user-123" })
    })
  })

  describe("handleLeave", () => {
    it("should handle user leaving", () => {
      const data = { userId: "user-123" }

      // First join the user
      gateway.handleJoin(data, mockSocket)

      const result = gateway.handleLeave(data, mockSocket)

      expect(mockSocket.leave).toHaveBeenCalledWith("user:user-123")
      expect(result).toEqual({ status: "left", userId: "user-123" })
    })
  })

  describe("sendNotificationToUser", () => {
    it("should send notification to specific user", async () => {
      const userId = "user-123"
      const notification = {
        id: "notification-123",
        type: "welcome",
        title: "Welcome",
        content: "Welcome message",
        createdAt: new Date(),
      }

      await gateway.sendNotificationToUser(userId, notification)

      expect(mockServer.to).toHaveBeenCalledWith("user:user-123")
      expect(mockServer.emit).toHaveBeenCalledWith("notification", notification)
    })
  })

  describe("sendNotificationToAll", () => {
    it("should broadcast notification to all users", async () => {
      const notification = {
        id: "notification-123",
        type: "system",
        title: "System Alert",
        content: "System maintenance",
        createdAt: new Date(),
      }

      await gateway.sendNotificationToAll(notification)

      expect(mockServer.emit).toHaveBeenCalledWith("notification", notification)
    })
  })

  describe("isUserConnected", () => {
    it("should return true if user is connected", () => {
      const data = { userId: "user-123" }
      gateway.handleJoin(data, mockSocket)

      const result = gateway.isUserConnected("user-123")

      expect(result).toBe(true)
    })

    it("should return false if user is not connected", () => {
      const result = gateway.isUserConnected("user-456")

      expect(result).toBe(false)
    })
  })
})
