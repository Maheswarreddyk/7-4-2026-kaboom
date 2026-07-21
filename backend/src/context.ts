import { AsyncLocalStorage } from 'node:async_hooks';

export const envStorage = new AsyncLocalStorage<Record<string, any>>();

export function getEnv(): Record<string, any> {
  return envStorage.getStore() || (globalThis as any).__env || {};
}
