ALTER TABLE "ai_proposals" DROP CONSTRAINT "ai_proposals_link_id_ai_links_id_fk";--> statement-breakpoint
ALTER TABLE "ai_proposals" DROP COLUMN "link_id";--> statement-breakpoint
ALTER TABLE "ai_proposals" DROP COLUMN "edit_token_hash";--> statement-breakpoint
DROP TABLE "ai_links";
