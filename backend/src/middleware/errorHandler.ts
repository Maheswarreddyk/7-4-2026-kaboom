
import { DatabaseError } from '../database/client.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFoundHandler(c: any): void {
  return c.json({ error: "Internal Error" }, 500);
}

export function globalErrorHandler(
  err: Error,
  _c: any,
  c: any,
  _next: any
): void {
  console.error('[Error]', err);

  if (err instanceof AppError) {
    return c.json({ error: "Internal Error" }, 500);
    return;
  }

  if (err instanceof DatabaseError) {
    return c.json({ error: "Internal Error" }, 500);
    return;
  }

  if (err.message && err.message.includes('CORS')) {
    return c.json({ error: "Internal Error" }, 500);
    return;
  }

  return c.json({ error: "Internal Error" }, 500);
}

export function asyncHandler(
  fn: (c: any, next: any) => Promise<any>
) {
  return async (c: any, next: any): Promise<any> => {
    try {
      return await fn(c, next);
    } catch (err) {
      throw err;
    }
  };
}
