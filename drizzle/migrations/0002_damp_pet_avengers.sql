-- Hand-corrected: drizzle-kit's SQLite table-recreate selected the two NEW
-- columns (googleId, avatarUrl) from the OLD users table, which does not have
-- them, so the generated migration failed with "no such column: googleId".
-- Existing rows get NULL for both, which is correct — they predate Google
-- sign-in. Regenerating this file will reintroduce the bug.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`passwordHash` text,
	`googleId` text,
	`avatarUrl` text,
	`name` text,
	`role` text DEFAULT 'user' NOT NULL,
	`username` text,
	`publicProfile` integer DEFAULT false NOT NULL,
	`bio` text,
	`demoExpiresAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastSignedIn` integer
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "passwordHash", "googleId", "avatarUrl", "name", "role", "username", "publicProfile", "bio", "demoExpiresAt", "createdAt", "updatedAt", "lastSignedIn") SELECT "id", "email", "passwordHash", NULL, NULL, "name", "role", "username", "publicProfile", "bio", "demoExpiresAt", "createdAt", "updatedAt", "lastSignedIn" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_googleId_unique` ON `users` (`googleId`);