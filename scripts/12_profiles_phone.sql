-- Adds support for saving a user's phone number on public.profiles as well.
-- Safe to run multiple times.

BEGIN;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

COMMIT;
