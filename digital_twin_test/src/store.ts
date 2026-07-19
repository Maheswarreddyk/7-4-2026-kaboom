import fs from 'fs';
import path from 'path';
import { UserAuditTrail, ActionLog } from './types';

class Store {
  public trails: Map<string, UserAuditTrail> = new Map();
  private outputPath: string;

  constructor() {
    this.outputPath = path.resolve(__dirname, '../reports');
    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
  }

  public initTrail(userId: string, sessionId: string, browserContextId: string, behavior: any) {
    this.trails.set(userId, {
      userId,
      sessionId,
      browserContextId,
      behavior,
      totalQueueWaitTimeMs: 0,
      totalConnectionEstablishmentTimeMs: 0,
      totalConnectedDurationMs: 0,
      finalOutcome: 'PENDING',
      actions: [],
    });
  }

  public logAction(userId: string, action: ActionLog) {
    const trail = this.trails.get(userId);
    if (trail) {
      trail.actions.push(action);
      this.emitUpdate(userId);
    }
  }

  public updateTrail(userId: string, updates: Partial<UserAuditTrail>) {
    const trail = this.trails.get(userId);
    if (trail) {
      Object.assign(trail, updates);
      this.emitUpdate(userId);
    }
  }

  public getTrailBySessionId(sessionId: string): UserAuditTrail | undefined {
    for (const trail of this.trails.values()) {
      if (trail.sessionId === sessionId) return trail;
    }
    return undefined;
  }

  private emitUpdate(userId: string) {
    if ((global as any).dashboardEmitter) {
      (global as any).dashboardEmitter.emit('update', this.trails.get(userId));
    }
  }

  public saveReport() {
    const reportPath = path.join(this.outputPath, `report_${Date.now()}.json`);
    const data = Array.from(this.trails.values());
    fs.writeFileSync(reportPath, JSON.stringify(data, null, 2));
    console.log(`[Store] Report saved to ${reportPath}`);
  }
}

export const store = new Store();
