import "dotenv/config";
import { hashPassword } from "../server/_core/auth";
import { ENV } from "../server/_core/env";
import { createUser, findUserByEmail } from "../server/db";
import { seedSandbox } from "../server/sandbox";

/**
 * Creates a local development account with sample writing.
 *
 * This is a convenience for working on the app, not a production fixture — the
 * public "try it" button mints its own private sandbox per visitor and does not
 * depend on this script having been run. The sample content itself lives in
 * `server/sandbox.ts` so both paths stay identical.
 */

const DEV_EMAIL = process.env.SEED_EMAIL ?? "dev@writingassistant.local";
const DEV_PASSWORD = process.env.SEED_PASSWORD ?? "devpassword";

async function seed() {
  const existing = await findUserByEmail(DEV_EMAIL);
  if (existing) {
    console.log(`\n  Dev account already exists (${DEV_EMAIL}). Nothing to do.`);
    console.log("  To rebuild it from scratch: npm run db:reset\n");
    return;
  }

  const user = await createUser({
    email: DEV_EMAIL,
    passwordHash: await hashPassword(DEV_PASSWORD),
    name: "Dev Writer",
  });

  await seedSandbox(user.id);

  console.log("\n  Seeded a development account.\n");
  console.log(`    email:    ${DEV_EMAIL}`);
  console.log(`    password: ${DEV_PASSWORD}\n`);
  console.log(`  Database: ${ENV.databaseFile}\n`);
}

seed()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
