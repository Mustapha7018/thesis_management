/** Application error carrying an HTTP status; the global handler maps it to the error envelope. */
export class AppError extends Error {
  statusCode: number
  /** Optional structured detail passed through the error envelope (e.g. CSV row errors). */
  payload?: unknown

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = "AppError"
    this.statusCode = statusCode
  }
}

export const badRequest = (message: string) => new AppError(400, message)
export const unauthorized = (message = "Authentication required.") => new AppError(401, message)
export const forbidden = (message = "You do not have access to this resource.") => new AppError(403, message)
export const notFound = (message = "Not found.") => new AppError(404, message)
export const conflict = (message: string) => new AppError(409, message)
