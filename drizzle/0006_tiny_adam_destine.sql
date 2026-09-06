CREATE TABLE IF NOT EXISTS "menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"parent_id" uuid,
	"name" varchar(100) NOT NULL,
	"label" varchar(100) NOT NULL,
	"icon" varchar(50),
	"path" varchar(255),
	"order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"permissions" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menus" ADD CONSTRAINT "menus_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menus_workspace_id_idx" ON "menus" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menus_parent_id_idx" ON "menus" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menus_order_idx" ON "menus" USING btree ("order");