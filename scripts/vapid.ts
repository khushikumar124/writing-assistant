import webpush from "web-push";

/**
 * Generates a Web Push key pair. Run once, put the output in the environment,
 * and never regenerate on a live deploy — every existing subscription is signed
 * against the old public key and would silently stop being delivered.
 */
const keys = webpush.generateVAPIDKeys();

console.log("\n  Add these to your environment (or `fly secrets set`):\n");
console.log(`    VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`    VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`    VAPID_SUBJECT=mailto:you@yourdomain.com\n`);
