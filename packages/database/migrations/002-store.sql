CREATE TABLE goodhand.orders(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE TABLE goodhand.checkout_receipts(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE TABLE goodhand.inventory(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0,
 CONSTRAINT valid_inventory CHECK ((payload->>'onHand')::integer >= 0 AND (payload->>'reserved')::integer >= 0 AND (payload->>'reserved')::integer <= (payload->>'onHand')::integer));
CREATE TABLE goodhand.stock_movements(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX movement_transaction_id ON goodhand.stock_movements((payload->>'transactionId'));
CREATE TABLE goodhand.outbox_messages(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE INDEX outbox_status ON goodhand.outbox_messages((payload->>'status'));
CREATE TABLE goodhand.failed_messages(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE TABLE goodhand.feedback(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE TABLE goodhand.followups(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE TABLE goodhand.mail_log(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE INDEX orders_owner ON goodhand.orders((payload->>'ownerId'));
