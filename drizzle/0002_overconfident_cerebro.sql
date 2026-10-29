CREATE TABLE "ai_links" (
	"id" text PRIMARY KEY NOT NULL,
	"list_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "ai_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"link_id" text NOT NULL,
	"list_id" text NOT NULL,
	"edit_token_hash" text NOT NULL,
	"items" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_proposals_status_check" CHECK ("ai_proposals"."status" in ('pending', 'accepted', 'rejected', 'expired')),
	CONSTRAINT "ai_proposals_version_check" CHECK ("ai_proposals"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "ai_links" ADD CONSTRAINT "ai_links_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_link_id_ai_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."ai_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_links_list_idx" ON "ai_links" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "ai_proposals_list_status_idx" ON "ai_proposals" USING btree ("list_id","status");
--> statement-breakpoint
ALTER TABLE "ai_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_proposals" ENABLE ROW LEVEL SECURITY;
