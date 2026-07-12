/**
 * SafeStorage Utility
 * 
 * Provides a highly resilient drop-in replacement for window.localStorage.
 * Protects against:
 *  - Safari Private Mode disabled/blocked storage access exceptions
 *  - QuotaExceededError crashes
 *  - Malformed or corrupted JSON parsing errors
 *  - Schema version mismatches (supporting version upgrades via migrate())
 */

const STORAGE_VERSION_KEY = 'kaboom_storage_version';
const CURRENT_STORAGE_VERSION = 1;

class SafeStorage implements Storage {
  private isAvailable: boolean;
  private memoryFallback: Map<string, string>;

  constructor() {
    this.memoryFallback = new Map<string, string>();
    this.isAvailable = this.checkAvailability();
    
    if (this.isAvailable) {
      this.initializeVersionAndMigrations();
    }
  }

  private checkAvailability(): boolean {
    try {
      const testKey = '__kaboom_storage_test__';
      window.localStorage.setItem(testKey, testKey);
      const retrieved = window.localStorage.getItem(testKey);
      window.localStorage.removeItem(testKey);
      return retrieved === testKey;
    } catch (e) {
      console.warn('[SafeStorage] localStorage is unavailable (Private browsing or permission denied). Falling back to in-memory storage.');
      return false;
    }
  }

  private initializeVersionAndMigrations(): void {
    try {
      const storedVersionStr = window.localStorage.getItem(STORAGE_VERSION_KEY);
      const storedVersion = storedVersionStr ? parseInt(storedVersionStr, 10) : 0;

      if (storedVersion < CURRENT_STORAGE_VERSION) {
        this.runMigrations(storedVersion, CURRENT_STORAGE_VERSION);
        window.localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_STORAGE_VERSION.toString());
      }
    } catch (e) {
      console.error('[SafeStorage] Version checking and migration initialization failed:', e);
    }
  }

  /**
   * Run schema migrations based on version diff
   */
  private runMigrations(oldVersion: number, newVersion: number): void {
    console.log(`[SafeStorage] Migrating storage schema from v${oldVersion} to v${newVersion}...`);
    try {
      // Future migrations go here:
      if (oldVersion < 1) {
        // Migration to version 1: Ensure initial preferences format matches
        const legacyDisplayName = window.localStorage.getItem('display_name');
        if (legacyDisplayName) {
          window.localStorage.setItem('kaboom_display_name', legacyDisplayName);
          window.localStorage.removeItem('display_name');
        }
      }
    } catch (e) {
      console.error('[SafeStorage] Migration failed:', e);
    }
  }

  // --- Storage API Interface Implementation ---

  get length(): number {
    if (this.isAvailable) {
      return window.localStorage.length;
    }
    return this.memoryFallback.size;
  }

  clear(): void {
    try {
      if (this.isAvailable) {
        window.localStorage.clear();
      }
    } catch (e) {
      console.error('[SafeStorage] failed to clear localStorage:', e);
    }
    this.memoryFallback.clear();
  }

  getItem(key: string): string | null {
    if (this.isAvailable) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        console.error(`[SafeStorage] failed to getItem for key "${key}":`, e);
      }
    }
    return this.memoryFallback.get(key) ?? null;
  }

  key(index: number): string | null {
    if (this.isAvailable) {
      try {
        return window.localStorage.key(index);
      } catch (e) {
        console.error(`[SafeStorage] failed to fetch key at index ${index}:`, e);
      }
    }
    const keys = Array.from(this.memoryFallback.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    if (this.isAvailable) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        console.error(`[SafeStorage] failed to removeItem for key "${key}":`, e);
      }
    }
    this.memoryFallback.delete(key);
  }

  setItem(key: string, value: string): void {
    // Keep in-memory store synchronized as fallback/cache
    this.memoryFallback.set(key, value);

    if (this.isAvailable) {
      try {
        window.localStorage.setItem(key, value);
      } catch (e: any) {
        if (
          e.name === 'QuotaExceededError' || 
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          e.code === 22
        ) {
          console.warn('[SafeStorage] LocalStorage quota exceeded. Evicting old keys to free space.');
          this.evictOldKeys();
          try {
            window.localStorage.setItem(key, value);
          } catch (retryErr) {
            console.error('[SafeStorage] Retrying setItem failed after key eviction:', retryErr);
          }
        } else {
          console.error(`[SafeStorage] failed to setItem for key "${key}":`, e);
        }
      }
    }
  }

  /**
   * Helper to parse JSON safely without throwing runtime crashes on malformed inputs
   */
  getJSON<T>(key: string, defaultValue: T): T {
    const rawValue = this.getItem(key);
    if (!rawValue) return defaultValue;

    try {
      return JSON.parse(rawValue) as T;
    } catch (e) {
      console.warn(`[SafeStorage] Key "${key}" contains corrupted/malformed JSON string: "${rawValue}". Returning default value.`);
      return defaultValue;
    }
  }

  /**
   * Helper to set JSON stringified values
   */
  setJSON(key: string, value: any): void {
    try {
      const stringified = JSON.stringify(value);
      this.setItem(key, stringified);
    } catch (e) {
      console.error(`[SafeStorage] Failed to stringify value for key "${key}":`, e);
    }
  }

  /**
   * Evict less critical keys to make room for active sessions
   */
  private evictOldKeys(): void {
    if (!this.isAvailable) return;
    try {
      // Evict transient and non-vital keys first
      const keysToEvict = [
        'kaboom_session_lifecycle',
        'kaboom_session_restored',
        'kaboom_tutorial_dismissed',
        'pipPosition',
        'kaboom_video_layout'
      ];

      keysToEvict.forEach((k) => {
        try {
          window.localStorage.removeItem(k);
          this.memoryFallback.delete(k);
        } catch {}
      });
      console.log('[SafeStorage] Successfully evicted transient keys.');
    } catch (e) {
      console.error('[SafeStorage] Eviction process failed:', e);
    }
  }
}

export const safeLocalStorage = new SafeStorage();
