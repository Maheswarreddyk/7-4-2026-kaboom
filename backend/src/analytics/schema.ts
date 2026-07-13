/**
 * Strict Analytics Event Payload Schema
 * 
 * Ensures all events logged to analytics_events.payload conform to a predictable structure.
 * This is critical for scaling aggregation queries and future AI analysis.
 */

export type MatchMode = 'QUICK' | 'SMART' | 'EXACT';

export interface AnalyticsEventPayload {
  // Geo & Demographics
  campus?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;

  // Match Details
  match_mode?: MatchMode | null;
  filters?: string[];
  
  // Growth & Funnel
  campaign_source?: string | null; // e.g. 'Instagram', 'Ambassador_Saveetha'
  funnel_step?: string | null;     // e.g. 'Opened App', 'Joined Queue'
  metric_value?: number | null;    // Numeric value if tracking quantities (e.g. 1)

  // Diagnostics & Duration
  duration_seconds?: number | null;
  wait_time_seconds?: number | null;
  
  // Allows extensibility but strongly typed fields are preferred
  [key: string]: string | number | boolean | null | undefined | object | string[];
}
