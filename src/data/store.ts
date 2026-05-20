import { Database } from "../types";
import { seedDatabase } from "./seed";
import { now, uid } from "../lib/utils";

const KEY = "vertice-demand-agent-db-v1";

export class LocalStore {
  load(): Database {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      this.save(seedDatabase);
      return structuredClone(seedDatabase);
    }
    return JSON.parse(raw) as Database;
  }

  save(db: Database) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  reset() {
    this.save(seedDatabase);
  }

  audit(db: Database, action: string, entityType?: string, entityId?: string, companyId?: string, metadata = {}) {
    db.auditLogs.unshift({
      id: uid("audit"),
      companyId,
      userId: "user_demo",
      action,
      entityType,
      entityId,
      metadata,
      createdAt: now(),
    });
  }
}

export const store = new LocalStore();
