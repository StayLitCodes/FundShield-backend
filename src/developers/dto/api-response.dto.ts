export class ApiResponseDto<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
  requestId?: string

  constructor(success: boolean, data?: T, error?: string, requestId?: string) {
    this.success = success
    this.data = data
    this.error = error
    this.timestamp = new Date()
    this.requestId = requestId
  }
}
