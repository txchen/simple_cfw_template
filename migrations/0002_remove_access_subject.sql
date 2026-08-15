DROP INDEX IF EXISTS users_access_subject_idx;

ALTER TABLE users DROP COLUMN access_subject;
