-- Adds support for saving a user's phone number.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS phone text;

COMMIT;
