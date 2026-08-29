CREATE TABLE "drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"ideaId" integer NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"wordCount" integer DEFAULT 0 NOT NULL,
	"characterCount" integer DEFAULT 0 NOT NULL,
	"platform" text DEFAULT 'both' NOT NULL,
	"lastSavedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"platform" text DEFAULT 'both' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"tags" text,
	"outline" text,
	"wordCount" integer DEFAULT 0 NOT NULL,
	"publishedUrl" text,
	"publishedAt" timestamp with time zone,
	"publishedIn" text,
	"targetPublishDate" timestamp with time zone,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer,
	"text" text NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pushSubscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"failureCount" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rawThoughts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"content" text NOT NULL,
	"tags" text,
	"linkedIdeaId" integer,
	"deletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research" (
	"id" serial PRIMARY KEY NOT NULL,
	"ideaId" integer NOT NULL,
	"userId" integer NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"notes" text,
	"source" text DEFAULT 'other',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userCategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userPreferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"defaultPlatform" text DEFAULT 'both' NOT NULL,
	"onboardingCompleted" boolean DEFAULT false NOT NULL,
	"dailyWordGoal" integer DEFAULT 0 NOT NULL,
	"reminderFrequency" text DEFAULT 'off' NOT NULL,
	"reminderTime" text DEFAULT '09:00' NOT NULL,
	"reminderDays" text,
	"timeZone" text DEFAULT 'UTC' NOT NULL,
	"lastRemindedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"googleId" text,
	"avatarUrl" text,
	"name" text,
	"role" text DEFAULT 'user' NOT NULL,
	"username" text,
	"publicProfile" boolean DEFAULT false NOT NULL,
	"bio" text,
	"demoExpiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "writingSessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"ideaId" integer,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"endedAt" timestamp with time zone,
	"wordsWritten" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_ideaId_ideas_id_fk" FOREIGN KEY ("ideaId") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pushSubscriptions" ADD CONSTRAINT "pushSubscriptions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rawThoughts" ADD CONSTRAINT "rawThoughts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rawThoughts" ADD CONSTRAINT "rawThoughts_linkedIdeaId_ideas_id_fk" FOREIGN KEY ("linkedIdeaId") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research" ADD CONSTRAINT "research_ideaId_ideas_id_fk" FOREIGN KEY ("ideaId") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research" ADD CONSTRAINT "research_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userCategories" ADD CONSTRAINT "userCategories_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userPreferences" ADD CONSTRAINT "userPreferences_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writingSessions" ADD CONSTRAINT "writingSessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writingSessions" ADD CONSTRAINT "writingSessions_ideaId_ideas_id_fk" FOREIGN KEY ("ideaId") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drafts_ideaId_unique" ON "drafts" USING btree ("ideaId");--> statement-breakpoint
CREATE INDEX "ideas_userId_idx" ON "ideas" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "prompts_userId_idx" ON "prompts" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "pushSubscriptions_endpoint_unique" ON "pushSubscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "pushSubscriptions_userId_idx" ON "pushSubscriptions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "rawThoughts_userId_idx" ON "rawThoughts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "research_ideaId_idx" ON "research" USING btree ("ideaId");--> statement-breakpoint
CREATE UNIQUE INDEX "userCategories_user_name_unique" ON "userCategories" USING btree ("userId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_googleId_unique" ON "users" USING btree ("googleId");--> statement-breakpoint
CREATE INDEX "writingSessions_userId_idx" ON "writingSessions" USING btree ("userId");