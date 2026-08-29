import "dotenv/config";
import { closeDb, migrateToLatest } from "../server/migrate";

/**
 * Deploy-time migration runner. Vercel runs this as part of the build, and it
 * is the only place migrations are applied.
 */
await migrateToLatest();
await closeDb();
