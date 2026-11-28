CREATE TABLE "ai_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_oauth_codes" (
	"hash" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"challenge" text NOT NULL,
	"resource" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_oauth_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_oauth_requests" (
	"hash" text PRIMARY KEY NOT NULL,
	"session_hash" text,
	"login_token_hash" text,
	"client_id" text NOT NULL,
	"query" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_oauth_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ai_oauth_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"kind" text NOT NULL,
	"resource" text NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "ai_oauth_tokens_kind_check" CHECK ("ai_oauth_tokens"."kind" in ('access', 'refresh'))
);
--> statement-breakpoint
ALTER TABLE "ai_oauth_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_proposals" ALTER COLUMN "link_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_proposals" ALTER COLUMN "edit_token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "connection_id" text;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "request_id" text;--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "ai_connections" ADD CONSTRAINT "ai_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_oauth_codes" ADD CONSTRAINT "ai_oauth_codes_connection_id_ai_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."ai_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_oauth_tokens" ADD CONSTRAINT "ai_oauth_tokens_connection_id_ai_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."ai_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_connections_active_user_client" ON "ai_connections" USING btree ("user_id","client_id") WHERE "ai_connections"."activated_at" is not null and "ai_connections"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "ai_oauth_tokens_connection_idx" ON "ai_oauth_tokens" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "ai_oauth_tokens_expiry_idx" ON "ai_oauth_tokens" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_connection_id_ai_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."ai_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_proposals_connection_request_idx" ON "ai_proposals" USING btree ("connection_id","request_id");