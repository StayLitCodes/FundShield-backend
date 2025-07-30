export class ComplianceCheckRequestDto {
  user: string;
  type: string; // AML, KYC, etc.
  data: any;
}

export class ComplianceCheckResponseDto {
  status: string; // PASSED, FAILED, PENDING
  details?: any;
  result?: any;
} 