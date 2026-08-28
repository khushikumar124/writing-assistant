CREATE TABLE `pushSubscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`failureCount` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pushSubscriptions_endpoint_unique` ON `pushSubscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `pushSubscriptions_userId_idx` ON `pushSubscriptions` (`userId`);--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `dailyWordGoal` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `reminderFrequency` text DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `reminderTime` text DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `reminderDays` text;--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `timeZone` text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `lastRemindedAt` integer;