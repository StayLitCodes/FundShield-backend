export enum DisputeStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  EVIDENCE_COLLECTION = 'evidence_collection',
  ARBITRATION = 'arbitration',
  VOTING = 'voting',
  RESOLVED = 'resolved',
  APPEALED = 'appealed',
  CLOSED = 'closed',
  EXPIRED = 'expired',
}

export enum DisputeType {
  PAYMENT_DISPUTE = 'payment_dispute',
  DELIVERY_DISPUTE = 'delivery_dispute',
  QUALITY_DISPUTE = 'quality_dispute',
  BREACH_OF_CONTRACT = 'breach_of_contract',
  FRAUD_CLAIM = 'fraud_claim',
  OTHER = 'other',
}

export enum DisputePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}