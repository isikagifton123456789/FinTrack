import type { ApiErrorBody } from '../types'

export class ApiError extends Error {
  status: number
  body: ApiErrorBody

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = { error: { code, message, details } }
  }
}
