CREATE TABLE `passwordResets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`tokenHash` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`usedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passwordResets_tokenHash_unique` ON `passwordResets` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `passwordResets_userId_idx` ON `passwordResets` (`userId`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer,
	`text` text NOT NULL,
	`kind` text DEFAULT 'general' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prompts_userId_idx` ON `prompts` (`userId`);--> statement-breakpoint
ALTER TABLE `ideas` ADD `publishedAt` integer;--> statement-breakpoint
ALTER TABLE `ideas` ADD `publishedIn` text;--> statement-breakpoint
ALTER TABLE `ideas` ADD `deletedAt` integer;--> statement-breakpoint
ALTER TABLE `rawThoughts` ADD `deletedAt` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `username` text;--> statement-breakpoint
ALTER TABLE `users` ADD `publicProfile` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `demoExpiresAt` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);