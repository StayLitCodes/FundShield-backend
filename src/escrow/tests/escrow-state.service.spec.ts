import { Test, type TestingModule } from "@nestjs/testing"
import { EscrowStateService } from "../services/escrow-state.service"
import { EscrowStatus } from "../enums/escrow-status.enum"

describe("EscrowStateService", () => {
  let service: EscrowStateService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EscrowStateService],
    }).compile()

    service = module.get<EscrowStateService>(EscrowStateService)
  })

  describe("canTransitionTo", () => {
    it("should allow valid state transitions", () => {
      expect(service.canTransitionTo(EscrowStatus.CREATED, EscrowStatus.FUNDED)).toBe(true)
      expect(service.canTransitionTo(EscrowStatus.FUNDED, EscrowStatus.IN_PROGRESS)).toBe(true)
      expect(service.canTransitionTo(EscrowStatus.IN_PROGRESS, EscrowStatus.COMPLETED)).toBe(true)
    })

    it("should reject invalid state transitions", () => {
      expect(service.canTransitionTo(EscrowStatus.COMPLETED, EscrowStatus.CREATED)).toBe(false)
      expect(service.canTransitionTo(EscrowStatus.CANCELLED, EscrowStatus.FUNDED)).toBe(false)
      expect(service.canTransitionTo(EscrowStatus.CREATED, EscrowStatus.COMPLETED)).toBe(false)
    })
  })

  describe("getNextPossibleStates", () => {
    it("should return correct next possible states", () => {
      const nextStates = service.getNextPossibleStates(EscrowStatus.CREATED)
      expect(nextStates).toContain(EscrowStatus.FUNDING_PENDING)
      expect(nextStates).toContain(EscrowStatus.FUNDED)
      expect(nextStates).toContain(EscrowStatus.CANCELLED)
      expect(nextStates).toContain(EscrowStatus.EXPIRED)
    })

    it("should return empty array for terminal states", () => {
      const nextStates = service.getNextPossibleStates(EscrowStatus.COMPLETED)
      expect(nextStates).toEqual([])
    })
  })

  describe("isTerminalState", () => {
    it("should identify terminal states correctly", () => {
      expect(service.isTerminalState(EscrowStatus.COMPLETED)).toBe(true)
      expect(service.isTerminalState(EscrowStatus.REFUNDED)).toBe(true)
      expect(service.isTerminalState(EscrowStatus.CREATED)).toBe(false)
      expect(service.isTerminalState(EscrowStatus.IN_PROGRESS)).toBe(false)
    })
  })

  describe("validateStateTransition", () => {
    it("should validate successful transitions", () => {
      const result = service.validateStateTransition(EscrowStatus.CREATED, EscrowStatus.FUNDED)
      expect(result.valid).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it("should reject invalid transitions", () => {
      const result = service.validateStateTransition(EscrowStatus.COMPLETED, EscrowStatus.CREATED)
      expect(result.valid).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it("should validate context-based transitions", () => {
      const result = service.validateStateTransition(EscrowStatus.FUNDED, EscrowStatus.IN_PROGRESS, { isFunded: false })
      expect(result.valid).toBe(false)
      expect(result.reason).toContain("must be funded")
    })
  })

  describe("getRequiredConditionsForTransition", () => {
    it("should return required conditions for specific transitions", () => {
      const conditions = service.getRequiredConditionsForTransition(EscrowStatus.CREATED, EscrowStatus.FUNDED)
      expect(conditions).toContain("Funds must be deposited")
      expect(conditions).toContain("Payment method verified")
    })

    it("should return empty array for undefined transitions", () => {
      const conditions = service.getRequiredConditionsForTransition(EscrowStatus.CREATED, EscrowStatus.COMPLETED)
      expect(conditions).toEqual([])
    })
  })
})
