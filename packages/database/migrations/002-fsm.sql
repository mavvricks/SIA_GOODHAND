CREATE TABLE goodhand.jobs(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX jobs_order_unique ON goodhand.jobs((payload->>'orderNumber'));
CREATE TABLE goodhand.appointments(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0,
 technician_id text NOT NULL, job_id text NOT NULL, status text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, occupied tstzrange NOT NULL,
 CONSTRAINT appointment_times CHECK (ends_at>starts_at),
 CONSTRAINT technician_two_hour_gap EXCLUDE USING gist (technician_id WITH =, occupied WITH &&) WHERE (status='active'));
CREATE OR REPLACE FUNCTION goodhand.appointment_columns() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.technician_id := NEW.payload->>'technicianId';
 NEW.job_id := NEW.payload->>'jobId';
 NEW.status := NEW.payload->>'status';
 NEW.starts_at := (NEW.payload->>'periodStart')::timestamptz;
 NEW.ends_at := (NEW.payload->>'periodEnd')::timestamptz;
 NEW.occupied := tstzrange(NEW.starts_at, NEW.ends_at + interval '2 hours', '[)');
 RETURN NEW;
END $$;
CREATE TRIGGER appointment_columns BEFORE INSERT OR UPDATE ON goodhand.appointments FOR EACH ROW EXECUTE FUNCTION goodhand.appointment_columns();
CREATE UNIQUE INDEX one_active_appointment_per_job ON goodhand.appointments(job_id) WHERE status='active';
CREATE TABLE goodhand.processed_messages(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE TABLE goodhand.outbox_messages(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE INDEX outbox_status ON goodhand.outbox_messages((payload->>'status'));
CREATE TABLE goodhand.technician_feedback(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE TABLE goodhand.followups(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE TABLE goodhand.technician_details(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
CREATE TABLE goodhand.mail_log(id text PRIMARY KEY, payload jsonb NOT NULL, position integer NOT NULL DEFAULT 0);
