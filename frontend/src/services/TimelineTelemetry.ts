export class TimelineTelemetry {
  private static events: { timestamp: number; component: string; event: string; details?: any }[] = [];

  static log(component: string, event: string, details?: any) {
    const timestamp = performance.now();
    this.events.push({ timestamp, component, event, details });
    
    // Also log to console with a specific prefix for easy filtering
    console.log(`[SYNC-TL][${timestamp.toFixed(2)}ms][${component}] ${event}`, details || '');
  }

  static getEvents() {
    return this.events;
  }

  static clear() {
    this.events = [];
  }
}
