ALTER TABLE "accounts" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "deleted_reason" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
