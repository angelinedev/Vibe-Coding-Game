-- ==============================================================================
-- reset_for_event.sql
-- Wipes all contest run data for a fresh live contest event.
-- Preserves: schema, admins, questions, question_secrets.
-- Wipes: teams, team_members, attempts, audit_logs, broadcasts, leaderboard_snapshot.
-- Resets: contest_state to 'not_started'.
-- ==============================================================================

BEGIN;

-- 1. Wipe submissions & attempts
TRUNCATE TABLE public.attempts CASCADE;

-- 2. Wipe leaderboard snapshots
TRUNCATE TABLE public.leaderboard_snapshot CASCADE;

-- 3. Wipe team members and join rate-limiting attempts
TRUNCATE TABLE public.team_join_attempts CASCADE;
TRUNCATE TABLE public.team_members CASCADE;

-- 4. Wipe teams
TRUNCATE TABLE public.teams CASCADE;

-- 5. Wipe telemetry & announcements
TRUNCATE TABLE public.audit_logs CASCADE;
TRUNCATE TABLE public.broadcasts CASCADE;

-- 6. Reset contest_state singleton to initial not_started state
UPDATE public.contest_state
SET 
    status = 'not_started',
    ends_at = NULL,
    paused_remaining_seconds = NULL,
    leaderboard_frozen = false,
    current_broadcast = NULL,
    updated_at = now()
WHERE id = 1;

-- If contest_state row is missing, insert initial row
INSERT INTO public.contest_state (
    id,
    status,
    ends_at,
    paused_remaining_seconds,
    leaderboard_frozen,
    current_broadcast,
    updated_at
)
VALUES (
    1,
    'not_started',
    NULL,
    NULL,
    false,
    NULL,
    now()
)
ON CONFLICT (id) DO NOTHING;

-- Log audit reset event
INSERT INTO public.audit_logs (
    event_type,
    severity,
    message,
    metadata
)
VALUES (
    'system_reset',
    'warning',
    'Contest event reset performed. All teams, members, attempts, and broadcasts cleared.',
    jsonb_build_object('timestamp', now())
);

COMMIT;
