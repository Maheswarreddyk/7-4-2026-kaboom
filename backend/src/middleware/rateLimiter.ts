import type { Context, Next } from 'hono';
export const rateLimiter = async (c: Context, next: Next) => { await next(); };
