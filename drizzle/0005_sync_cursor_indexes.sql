-- The deployment migrator runs this in a transaction, so bound writer blocking.
SELECT set_config('list.migration_lock_timeout', current_setting('lock_timeout'), true),
       set_config('list.migration_statement_timeout', current_setting('statement_timeout'), true);
--> statement-breakpoint
SET LOCAL lock_timeout = '1s';
--> statement-breakpoint
SET LOCAL statement_timeout = '5s';
--> statement-breakpoint
CREATE INDEX "items_updated_seq_idx" ON "items" USING btree ("updated_seq");
--> statement-breakpoint
CREATE INDEX "lists_updated_seq_idx" ON "lists" USING btree ("updated_seq");
--> statement-breakpoint
SELECT set_config('lock_timeout', current_setting('list.migration_lock_timeout'), true),
       set_config('statement_timeout', current_setting('list.migration_statement_timeout'), true);
