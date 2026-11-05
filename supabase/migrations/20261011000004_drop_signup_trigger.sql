-- ==============================================================================
-- PROMPT ARENA MIGRATION: 20261011000004_drop_signup_trigger.sql
-- ==============================================================================
-- Description:
-- Drops the database-level tr_reject_public_email_signup trigger.
-- Public email signups are natively halted by Supabase Auth (GoTrue) via
-- enable_signup = false, which returns standard HTTP 400 'signup_disabled'
-- and avoids brittle hardcoded email bypasses inside PostgreSQL.
-- ==============================================================================

DROP TRIGGER IF EXISTS tr_reject_public_email_signup ON auth.users;
DROP FUNCTION IF EXISTS public.reject_public_email_signup();
