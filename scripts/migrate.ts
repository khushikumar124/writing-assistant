import "dotenv/config";
import { migrateToLatest } from "../server/migrate";

/**
 * Standalone migration runner, kept for `npm run db:migrate` and for platforms
 * that prefer a release command. The server also migrates on boot, so this is
 * a convenience rather than a requirement.
 */
await migrateToLatest();
