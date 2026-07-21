import { safeLocalStorage } from './safeStorage.js';
import { STORAGE_KEYS } from '../types/index.js';


export function resetToCleanState(reason: string, keepFilters: boolean = false) {
  console.log(`[Cleanup] Resetting to clean state (Reason: ${reason}, KeepFilters: ${keepFilters})`);
  
  const keysToRemove = [
    STORAGE_KEYS.SESSION_ID,
    STORAGE_KEYS.SESSION_TOKEN,
    'kaboom_session_lifecycle',
    'kaboom_session',
    'kaboom_queue',
    'kaboom_match',
    'kaboom_partner',
    'kaboom_search_preferences',
    'kaboom_waiting',
    'kaboom_match_policy',
    'kaboom_current_state'
  ];

  if (!keepFilters) {
    keysToRemove.push(
      'kaboom_gender',
      'kaboom_looking',
      'kaboom_match_mode',
      'kaboom_match_constraints',
      'kaboom_university',
      'kaboom_education_tags',
      'kaboom_interest_tags',
      'kaboom_country',
      'kaboom_city',
      'kaboom_languages',
      'kaboom_filters'
    );
  }

  keysToRemove.forEach(key => safeLocalStorage.removeItem(key));
}

export async function cleanupSession(reason: string) {
  const sessionId = safeLocalStorage.getItem(STORAGE_KEYS.SESSION_ID);
  
  if (sessionId) {
    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
    // Tell the backend (fire and forget — page might be closing)
    navigator.sendBeacon(`${apiUrl}/api/session/cleanup`, JSON.stringify({ sessionId, reason }));
  }
  
  // Reset all local state
  resetToCleanState(reason);
}
