export enum EvidenceType {
  DOCUMENT = 'document',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  TRANSACTION_PROOF = 'transaction_proof',
  COMMUNICATION = 'communication',
  CONTRACT = 'contract',
  OTHER = 'other',
}

export enum EvidenceStatus {
  PENDING_REVIEW = 'pending_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  DISPUTED = 'disputed',
}