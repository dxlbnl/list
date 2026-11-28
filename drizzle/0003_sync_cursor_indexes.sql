CREATE INDEX "items_updated_seq_idx" ON "items" USING btree ("updated_seq");--> statement-breakpoint
CREATE INDEX "lists_updated_seq_idx" ON "lists" USING btree ("updated_seq");