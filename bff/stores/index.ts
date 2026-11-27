import { FileBackedSessionStore, type SessionAndCartStore } from "./sessionStore";
import { PostgresSessionStore } from "./postgresStore";

export function createSessionStoreFromEnv(): SessionAndCartStore {
  const dbUrl = process.env["DATABASE_URL"]?.trim();
  if (dbUrl) {
    return new PostgresSessionStore(dbUrl);
  }
  return new FileBackedSessionStore(process.env["BFF_STATE_FILE"]);
}
