-- ==============================================================================
-- Prompt Arena - Migration 003: Security Lockdown & Participant Privacy Hardening
-- ==============================================================================

-- 1. HARDEN TEAMS TABLE RLS
-- Participants must NOT be able to query the teams table directly across all teams.
-- They may only inspect their own team row (to check status, tab switch count, name).
-- All leaderboard standings must be accessed strictly through get_leaderboard().

DROP POLICY IF EXISTS "Anyone can view teams for leaderboard" ON public.teams;
DROP POLICY IF EXISTS "Members can view own team" ON public.teams;
DROP POLICY IF EXISTS "Admins have full access to teams" ON public.teams;

CREATE POLICY "Admins have full access to teams"
ON public.teams FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Members can view own team"
ON public.teams FOR SELECT TO anon, authenticated
USING (public.is_admin() OR public.is_team_member(id));


-- 2. HARDEN AUDIT LOGS RLS
-- Audit logs contain game master actions, administrative notes, and system telemetry.
-- They are strictly confidential and MUST NEVER be accessible by participants or anon.

DROP POLICY IF EXISTS "Anyone can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins have full access to audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins only access audit logs" ON public.audit_logs;

CREATE POLICY "Admins only access audit logs"
ON public.audit_logs FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());


-- 3. HARDEN ATTEMPTS INSERT RLS
-- Participants must NOT be able to set score, passed, or actual_output.
-- Only the verify-attempt Edge Function / service role can set these.
DROP POLICY IF EXISTS "Members can insert own team attempts when contest running and question live" ON public.attempts;

CREATE POLICY "Members can insert own team attempts when contest running and question live"
ON public.attempts FOR INSERT TO anon, authenticated
WITH CHECK (
    public.is_team_member(team_id)
    AND user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.teams t 
        WHERE t.id = attempts.team_id AND t.status = 'active'
    )
    AND EXISTS (
        SELECT 1 FROM public.contest_state cs 
        WHERE cs.id = 1 AND cs.status = 'running'
    )
    AND EXISTS (
        SELECT 1 FROM public.questions q 
        WHERE q.id = attempts.question_id AND q.status = 'live'
    )
    AND (
        public.is_admin() 
        OR (COALESCE(score, 0) = 0 AND COALESCE(passed, false) = false AND actual_output IS NULL)
    )
);


-- 4. HARDEN TAB SWITCH RPC
-- Must reject if user is not in a team, OR if the contest is not running.
CREATE OR REPLACE FUNCTION public.increment_tab_switch()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_team_id UUID;
    v_team_name TEXT;
    v_member_name TEXT;
    v_member_count INT;
    v_total_team_switches INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to log tab switch';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.contest_state WHERE id = 1 AND status = 'running'
    ) THEN
        RAISE EXCEPTION 'Contest is not currently running';
    END IF;

    UPDATE public.team_members
    SET 
        tab_switch_count = tab_switch_count + 1,
        last_seen_at = now()
    WHERE user_id = v_caller_id
    RETURNING team_id, display_name, tab_switch_count INTO v_team_id, v_member_name, v_member_count;

    IF v_team_id IS NULL THEN
        RAISE EXCEPTION 'Caller is not a registered member of any team';
    END IF;

    SELECT name, tab_switch_count INTO v_team_name, v_total_team_switches
    FROM public.teams
    WHERE id = v_team_id;

    INSERT INTO public.audit_logs (
        event_type,
        team_id,
        team_name,
        user_id,
        severity,
        message,
        metadata
    )
    VALUES (
        'tab_switch',
        v_team_id,
        v_team_name,
        v_caller_id,
        CASE WHEN v_total_team_switches >= 3 THEN 'warning' ELSE 'info' END,
        format('Team ''%s'' contestant ''%s'' tabbed out (Member: %s, Team Total: %s)', 
               v_team_name, v_member_name, v_member_count, v_total_team_switches),
        jsonb_build_object(
            'member_name', v_member_name,
            'member_count', v_member_count,
            'team_total', v_total_team_switches
        )
    );

    RETURN v_total_team_switches;
END;
$$;


-- 5. SAFE CONTEST AGGREGATES RPC
-- Exposes high-level counts (active teams, attempts) to participants safely
-- without granting SELECT on the teams table or attempts table.

CREATE OR REPLACE FUNCTION public.get_contest_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_total_teams INT;
    v_total_attempts INT;
BEGIN
    SELECT count(*)::int INTO v_total_teams 
    FROM public.teams 
    WHERE status = 'active';

    SELECT count(*)::int INTO v_total_attempts 
    FROM public.attempts;

    RETURN jsonb_build_object(
        'total_teams', v_total_teams,
        'total_attempts', v_total_attempts
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_contest_stats() TO anon, authenticated;


-- 6. BONUS QUESTION INJECTION RPC
-- Securely unlocks a question by ID with strict admin verification.

CREATE OR REPLACE FUNCTION public.inject_bonus_question(p_question_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_q RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    UPDATE public.questions
    SET status = 'live'
    WHERE id = p_question_id
    RETURNING * INTO v_q;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Question % not found', p_question_id;
    END IF;

    INSERT INTO public.audit_logs (event_type, severity, message, metadata)
    VALUES (
        'bonus_question_injected',
        'warning',
        'Bonus question released: ' || v_q.title,
        jsonb_build_object('question_id', p_question_id, 'title', v_q.title)
    );

    RETURN jsonb_build_object('success', true, 'question_id', p_question_id, 'title', v_q.title);
END;
$$;

GRANT EXECUTE ON FUNCTION public.inject_bonus_question(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;

-- 7. REJECT PUBLIC EMAIL SIGNUPS VIA DATABASE TRIGGER
-- Anonymous users are allowed (for participants).
-- Admin accounts can only be provisioned via service role with is_admin_provisioned = true.
-- Public email signups via client auth API are strictly rejected.

CREATE OR REPLACE FUNCTION public.reject_public_email_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Allow anonymous participant sign-ins
    IF NEW.is_anonymous = true THEN
        RETURN NEW;
    END IF;

    -- Allow admin accounts created via Dashboard / service_role / CLI superuser or provision metadata
    IF current_user IN ('postgres', 'supabase_admin', 'service_role')
       OR (NEW.raw_app_meta_data->>'is_admin_provisioned')::boolean = true THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Public email signups are disabled. Only administrators may provision accounts.';
END;
$$;

DROP TRIGGER IF EXISTS tr_reject_public_email_signup ON auth.users;
CREATE TRIGGER tr_reject_public_email_signup
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.reject_public_email_signup();
