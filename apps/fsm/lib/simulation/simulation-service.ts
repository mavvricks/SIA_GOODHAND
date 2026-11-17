import { attachPersistence } from '../../../../packages/local-db/index.mjs';
export class SimulationService {
  private flags: Map<string, string> = new Map();

  constructor() {
    this.flags.set('partner_outage_simulated', 'false');
  }

  public getFlag(key: string): boolean {
    return this.flags.get(key) === 'true';
  }

  public setFlag(key: string, value: boolean): void {
    this.flags.set(key, value ? 'true' : 'false');
  }

  public getAllFlags(): Record<string, boolean> {
    const res: Record<string, boolean> = {};
    for (const [k, v] of this.flags.entries()) {
      res[k] = v === 'true';
    }
    return res;
  }

  public reset(): void {
    this.flags.set('partner_outage_simulated', 'false');
  }
}

export const simulationService = attachPersistence(new SimulationService(), "fsm", "simulation") as SimulationService;
