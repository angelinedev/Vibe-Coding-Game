-- ==============================================================================
-- 20261011000001_schema.sql
-- Vibe Coding Prompt-Engineering Contest - Supabase Backend Foundation
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 2.1 ADMINS
-- Super administrators mapped directly to Supabase Auth users.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper function to check if the caller is an active admin.
-- STABLE + SECURITY DEFINER avoids recursion in RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admins
        WHERE id = auth.uid()
    );
$$;

-- ------------------------------------------------------------------------------
-- 2.2 JOIN CODE GENERATOR
-- Generates an unambiguous 8-character code formatted as ARENA-XXXX.
-- Alphabet excludes visually ambiguous characters (no 0, O, 1, I).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    v_code TEXT;
    v_exists BOOLEAN;
    v_i INT;
    v_chars TEXT;
BEGIN
    LOOP
        v_chars := '';
        FOR v_i IN 1..8 LOOP
            v_chars := v_chars || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);
        END LOOP;
        
        v_code := 'ARENA-' || substr(v_chars, 1, 4) || substr(v_chars, 5, 4);

        SELECT EXISTS (SELECT 1 FROM public.teams WHERE join_code = v_code) INTO v_exists;
        IF NOT v_exists THEN
            RETURN v_code;
        END IF;
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2.3 TEAMS
-- Participant teams with join codes.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    join_code TEXT NOT NULL UNIQUE DEFAULT public.generate_join_code(),
    max_members INT NOT NULL DEFAULT 3 CHECK (max_members BETWEEN 1 AND 10),
    join_locked BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disqualified')),
    tab_switch_count INT NOT NULL DEFAULT 0 CHECK (tab_switch_count >= 0),
    best_score INT NOT NULL DEFAULT 0 CHECK (best_score >= 0),
    best_score_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_status ON public.teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON public.teams(join_code);
CREATE INDEX IF NOT EXISTS idx_teams_leaderboard ON public.teams(best_score DESC, best_score_at ASC NULLS LAST);

-- ------------------------------------------------------------------------------
-- 2.4 TEAM MEMBERS
-- Individual participants connected to a team (up to max_members per team).
-- Keyed to anonymous auth sessions: user_id = auth.uid().
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    tab_switch_count INT NOT NULL DEFAULT 0 CHECK (tab_switch_count >= 0),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_team_members_user UNIQUE (user_id),
    CONSTRAINT uq_team_members_team_user UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.get_caller_team_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT team_id FROM public.team_members
    WHERE user_id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = p_team_id AND user_id = auth.uid()
    );
$$;

-- Trigger: automatically synchronize member tab switch counts into teams.tab_switch_count
CREATE OR REPLACE FUNCTION public.sync_team_tab_switches()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.teams
    SET 
        tab_switch_count = COALESCE((
            SELECT SUM(tab_switch_count) 
            FROM public.team_members 
            WHERE team_id = NEW.team_id
        ), 0),
        last_seen_at = now()
    WHERE id = NEW.team_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_team_tab_switches
AFTER INSERT OR UPDATE OF tab_switch_count ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_tab_switches();

CREATE OR REPLACE FUNCTION public.sync_team_tab_switches_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.teams
    SET 
        tab_switch_count = COALESCE((
            SELECT SUM(tab_switch_count) 
            FROM public.team_members 
            WHERE team_id = OLD.team_id
        ), 0),
        last_seen_at = now()
    WHERE id = OLD.team_id;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_sync_team_tab_switches_delete
AFTER DELETE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_tab_switches_on_delete();

-- ------------------------------------------------------------------------------
-- 2.5 RATE LIMITING FOR JOIN CODES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_join_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attempted_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_join_attempts_user ON public.team_join_attempts(user_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2.6 QUESTIONS
-- Contest challenge questions visible to participants when status = 'live'.
-- NOTE: 'expected_output' is deliberately stored separately in question_secrets.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    input_data TEXT NOT NULL,
    max_points INT NOT NULL DEFAULT 100 CHECK (max_points > 0),
    order_index INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'live', 'closed')),
    tier TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (tier IN ('EASY', 'MEDIUM', 'HARD', 'BOSS')),
    category TEXT NOT NULL DEFAULT 'ALGORITHMS',
    is_bonus BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_status_order ON public.questions(status, order_index ASC);

-- ------------------------------------------------------------------------------
-- 2.7 QUESTION_SECRETS
-- Sensitive ground-truth outputs. Accessible ONLY by admins and the service role.
-- Never exposed to participants.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_secrets (
    question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    expected_output TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2.8 CONTEST_STATE
-- Singleton table holding the global contest operational lifecycle state.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contest_state (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'running', 'paused', 'ended')),
    ends_at TIMESTAMPTZ,
    paused_remaining_seconds INT CHECK (paused_remaining_seconds >= 0 OR paused_remaining_seconds IS NULL),
    leaderboard_frozen BOOLEAN NOT NULL DEFAULT false,
    current_broadcast TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2.9 BROADCASTS
-- Broadcast notices transmitted live to all teams.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'flash', 'alert')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_active ON public.broadcasts(active, created_at DESC);

-- ------------------------------------------------------------------------------
-- 2.10 AUDIT_LOGS
-- System, admin, and proctor events.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    team_name TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);

-- ------------------------------------------------------------------------------
-- 2.11 LEADERBOARD_SNAPSHOT
-- Captured frozen rankings when contest_state.leaderboard_frozen = true.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshot (
    team_id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    best_score INT NOT NULL,
    best_score_at TIMESTAMPTZ,
    tab_switch_count INT NOT NULL,
    rank INT NOT NULL,
    frozen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2.12 ATTEMPTS
-- Prompt submissions per team.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    generated_code TEXT,
    actual_output TEXT,
    passed BOOLEAN NOT NULL DEFAULT false,
    score INT NOT NULL DEFAULT 0 CHECK (score >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_team_question ON public.attempts(team_id, question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created_at ON public.attempts(created_at DESC);

-- ==============================================================================
-- 3. TRIGGERS: CUMULATIVE CONTEST SCORING
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_attempt_scored()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_best INT;
    v_prev_best INT;
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.score IS NOT DISTINCT FROM NEW.score) THEN
        RETURN NEW;
    END IF;

    -- Cumulative sum of highest score per question for this team
    SELECT COALESCE(SUM(max_q_score), 0) INTO v_total_best
    FROM (
        SELECT MAX(score) AS max_q_score
        FROM public.attempts
        WHERE team_id = NEW.team_id
        GROUP BY question_id
    ) q_scores;

    SELECT best_score INTO v_prev_best
    FROM public.teams
    WHERE id = NEW.team_id;

    IF v_total_best > COALESCE(v_prev_best, 0) THEN
        UPDATE public.teams
        SET 
            best_score = v_total_best,
            best_score_at = now()
        WHERE id = NEW.team_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attempt_scored
AFTER INSERT OR UPDATE OF score ON public.attempts
FOR EACH ROW
EXECUTE FUNCTION public.handle_attempt_scored();

-- ==============================================================================
-- 4. VIEWS & STORED PROCEDURES (RPCs)
-- ==============================================================================

-- 4.1 LEADERBOARD VIEW
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
    t.id AS team_id,
    t.name,
    t.best_score,
    t.best_score_at,
    t.tab_switch_count,
    ROW_NUMBER() OVER (
        ORDER BY t.best_score DESC, t.best_score_at ASC NULLS LAST, t.created_at ASC
    ) AS rank
FROM public.teams t
WHERE t.status = 'active';

-- 4.2 GET_LEADERBOARD RPC (Freeze-Aware)
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
    team_id UUID,
    name TEXT,
    best_score INT,
    best_score_at TIMESTAMPTZ,
    tab_switch_count INT,
    rank BIGINT,
    is_frozen BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_frozen BOOLEAN;
    v_caller_is_admin BOOLEAN;
BEGIN
    SELECT leaderboard_frozen INTO v_frozen
    FROM public.contest_state
    WHERE id = 1;

    v_caller_is_admin := public.is_admin();

    IF v_frozen AND NOT v_caller_is_admin THEN
        RETURN QUERY
        SELECT 
            ls.team_id,
            ls.name,
            ls.best_score,
            ls.best_score_at,
            ls.tab_switch_count,
            ls.rank::BIGINT,
            true AS is_frozen
        FROM public.leaderboard_snapshot ls
        ORDER BY ls.rank ASC;
    ELSE
        RETURN QUERY
        SELECT 
            t.id AS team_id,
            t.name,
            t.best_score,
            t.best_score_at,
            t.tab_switch_count,
            ROW_NUMBER() OVER (
                ORDER BY t.best_score DESC, t.best_score_at ASC NULLS LAST, t.created_at ASC
            ) AS rank,
            v_frozen AS is_frozen
        FROM public.teams t
        WHERE t.status = 'active'
        ORDER BY t.best_score DESC, t.best_score_at ASC NULLS LAST, t.created_at ASC;
    END IF;
END;
$$;

-- 4.3 JOIN_TEAM RPC
CREATE OR REPLACE FUNCTION public.join_team(code TEXT, display_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_clean_code TEXT;
    v_clean_name TEXT;
    v_team RECORD;
    v_current_count INT;
    v_failed_attempts INT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to join a team';
    END IF;

    v_clean_code := UPPER(TRIM(COALESCE(code, '')));
    v_clean_name := TRIM(COALESCE(display_name, ''));

    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'Display name cannot be empty';
    END IF;

    -- If user is already a member of a team, return existing team info
    IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = v_caller_id) THEN
        SELECT t.id, t.name INTO v_team.id, v_team.name
        FROM public.team_members tm
        JOIN public.teams t ON t.id = tm.team_id
        WHERE tm.user_id = v_caller_id;

        RETURN jsonb_build_object(
            'success', true,
            'already_member', true,
            'team_id', v_team.id,
            'team_name', v_team.name,
            'message', 'Already joined team'
        );
    END IF;

    -- Rate-limiting: max 5 failed attempts in last 5 minutes
    SELECT COUNT(*) INTO v_failed_attempts
    FROM public.team_join_attempts
    WHERE user_id = v_caller_id
      AND created_at >= (now() - interval '5 minutes');

    IF v_failed_attempts >= 5 THEN
        RAISE EXCEPTION 'Too many failed join attempts. Please wait 5 minutes before trying again.';
    END IF;

    -- Match code case-insensitively with or without hyphens
    SELECT * INTO v_team
    FROM public.teams
    WHERE UPPER(join_code) = v_clean_code
       OR UPPER(REPLACE(join_code, '-', '')) = UPPER(REPLACE(v_clean_code, '-', ''));

    IF v_team.id IS NULL THEN
        INSERT INTO public.team_join_attempts (user_id, attempted_code)
        VALUES (v_caller_id, v_clean_code);

        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid join code. Please check and try again.'
        );
    END IF;

    IF v_team.status = 'disqualified' THEN
        RAISE EXCEPTION 'This team has been disqualified.';
    END IF;

    IF v_team.join_locked THEN
        RAISE EXCEPTION 'This team join code is currently locked by the administrator.';
    END IF;

    SELECT COUNT(*) INTO v_current_count
    FROM public.team_members
    WHERE team_id = v_team.id;

    IF v_current_count >= v_team.max_members THEN
        RAISE EXCEPTION 'Team is full (% of % members).', v_current_count, v_team.max_members;
    END IF;

    -- Insert caller into team_members
    INSERT INTO public.team_members (
        team_id,
        user_id,
        display_name
    )
    VALUES (
        v_team.id,
        v_caller_id,
        v_clean_name
    );

    UPDATE public.teams SET last_seen_at = now() WHERE id = v_team.id;
    DELETE FROM public.team_join_attempts WHERE user_id = v_caller_id;

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
        'team_join',
        v_team.id,
        v_team.name,
        v_caller_id,
        'info',
        format('Contestant ''%s'' joined Team ''%s'' (%s/%s members)', 
               v_clean_name, v_team.name, v_current_count + 1, v_team.max_members),
        jsonb_build_object(
            'display_name', v_clean_name,
            'member_count', v_current_count + 1,
            'max_members', v_team.max_members
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_name', v_team.name,
        'display_name', v_clean_name
    );
END;
$$;

-- 4.4 INCREMENT_TAB_SWITCH RPC
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

-- 4.5 ADMIN MANAGEMENT RPCs
CREATE OR REPLACE FUNCTION public.create_team(p_name TEXT, p_max_members INT DEFAULT 3)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_team public.teams%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    INSERT INTO public.teams (name, max_members)
    VALUES (TRIM(p_name), COALESCE(p_max_members, 3))
    RETURNING * INTO v_new_team;

    INSERT INTO public.audit_logs (
        event_type,
        team_id,
        team_name,
        severity,
        message
    )
    VALUES (
        'team_created',
        v_new_team.id,
        v_new_team.name,
        'info',
        format('Admin created Team ''%s'' (Join Code: %s)', v_new_team.name, v_new_team.join_code)
    );

    RETURN to_jsonb(v_new_team);
END;
$$;

CREATE OR REPLACE FUNCTION public.bulk_create_teams(
    p_count INT,
    p_name_prefix TEXT DEFAULT 'Team',
    p_max_members INT DEFAULT 3
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_created INT := 0;
    v_i INT;
    v_team_name TEXT;
    v_existing INT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    IF p_count < 1 OR p_count > 100 THEN
        RAISE EXCEPTION 'Count must be between 1 and 100';
    END IF;

    SELECT COUNT(*) INTO v_existing FROM public.teams;

    FOR v_i IN 1..p_count LOOP
        v_team_name := p_name_prefix || ' ' || LPAD((v_existing + v_i)::text, 2, '0');
        BEGIN
            INSERT INTO public.teams (name, max_members)
            VALUES (v_team_name, COALESCE(p_max_members, 3));
            v_created := v_created + 1;
        EXCEPTION WHEN unique_violation THEN
            -- Retry with random suffix
            v_team_name := p_name_prefix || ' ' || LPAD((v_existing + v_i)::text, 2, '0') || '-' || substr(md5(random()::text), 1, 3);
            INSERT INTO public.teams (name, max_members)
            VALUES (v_team_name, COALESCE(p_max_members, 3));
            v_created := v_created + 1;
        END;
    END LOOP;

    INSERT INTO public.audit_logs (
        event_type,
        severity,
        message
    )
    VALUES (
        'teams_bulk_created',
        'info',
        format('Admin bulk-created %s teams with prefix ''%s''', v_created, p_name_prefix)
    );

    RETURN v_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_join_code(p_team_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_code TEXT;
    v_team_name TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    v_new_code := public.generate_join_code();

    UPDATE public.teams
    SET join_code = v_new_code
    WHERE id = p_team_id
    RETURNING name INTO v_team_name;

    INSERT INTO public.audit_logs (
        event_type,
        team_id,
        team_name,
        severity,
        message
    )
    VALUES (
        'join_code_regenerated',
        p_team_id,
        v_team_name,
        'warning',
        format('Join code for Team ''%s'' regenerated to %s', v_team_name, v_new_code)
    );

    RETURN v_new_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_join_lock(p_team_id UUID, p_locked BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_team_name TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    UPDATE public.teams
    SET join_locked = p_locked
    WHERE id = p_team_id
    RETURNING name INTO v_team_name;

    INSERT INTO public.audit_logs (
        event_type,
        team_id,
        team_name,
        severity,
        message
    )
    VALUES (
        'join_lock_toggled',
        p_team_id,
        v_team_name,
        'info',
        format('Team ''%s'' join lock set to: %s', v_team_name, p_locked)
    );

    RETURN p_locked;
END;
$$;

CREATE OR REPLACE FUNCTION public.kick_team_member(p_team_id UUID, p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member_name TEXT;
    v_team_name TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    DELETE FROM public.team_members
    WHERE id = p_member_id AND team_id = p_team_id
    RETURNING display_name INTO v_member_name;

    SELECT name INTO v_team_name FROM public.teams WHERE id = p_team_id;

    INSERT INTO public.audit_logs (
        event_type,
        team_id,
        team_name,
        severity,
        message
    )
    VALUES (
        'member_kicked',
        p_team_id,
        v_team_name,
        'warning',
        format('Contestant ''%s'' was kicked from Team ''%s'' by Admin', v_member_name, v_team_name)
    );

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.disqualify_team(p_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_team_name TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    UPDATE public.teams
    SET status = 'disqualified'
    WHERE id = p_team_id
    RETURNING name INTO v_team_name;

    DELETE FROM public.leaderboard_snapshot
    WHERE team_id = p_team_id;

    INSERT INTO public.audit_logs (
        event_type,
        team_id,
        team_name,
        severity,
        message
    )
    VALUES (
        'disqualification',
        p_team_id,
        v_team_name,
        'critical',
        format('Team ''%s'' was DISQUALIFIED by Admin', v_team_name)
    );
END;
$$;

-- 4.6 CONTEST LIFECYCLE RPCs
CREATE OR REPLACE FUNCTION public.start_contest(p_duration_minutes INT DEFAULT 90)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    UPDATE public.contest_state
    SET 
        status = 'running',
        ends_at = now() + (p_duration_minutes || ' minutes')::INTERVAL,
        paused_remaining_seconds = NULL,
        updated_at = now()
    WHERE id = 1;

    INSERT INTO public.audit_logs (event_type, severity, message)
    VALUES ('contest_lifecycle', 'info', format('Contest started with %s minutes duration', p_duration_minutes));
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_contest()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ends_at TIMESTAMPTZ;
    v_rem_sec INT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    SELECT ends_at INTO v_ends_at
    FROM public.contest_state
    WHERE id = 1 AND status = 'running';

    IF v_ends_at IS NOT NULL THEN
        v_rem_sec := GREATEST(0, EXTRACT(EPOCH FROM (v_ends_at - now()))::INT);
    ELSE
        v_rem_sec := 0;
    END IF;

    UPDATE public.contest_state
    SET 
        status = 'paused',
        paused_remaining_seconds = v_rem_sec,
        updated_at = now()
    WHERE id = 1;

    INSERT INTO public.audit_logs (event_type, severity, message)
    VALUES ('contest_lifecycle', 'warning', format('Contest paused. %s seconds remaining', v_rem_sec));
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_contest()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rem_sec INT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    SELECT paused_remaining_seconds INTO v_rem_sec
    FROM public.contest_state
    WHERE id = 1 AND status = 'paused';

    IF v_rem_sec IS NULL THEN
        v_rem_sec := 0;
    END IF;

    UPDATE public.contest_state
    SET 
        status = 'running',
        ends_at = now() + (v_rem_sec || ' seconds')::INTERVAL,
        paused_remaining_seconds = NULL,
        updated_at = now()
    WHERE id = 1;

    INSERT INTO public.audit_logs (event_type, severity, message)
    VALUES ('contest_lifecycle', 'info', format('Contest resumed. New ends_at set with %s seconds remaining', v_rem_sec));
END;
$$;

CREATE OR REPLACE FUNCTION public.end_contest()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    UPDATE public.contest_state
    SET 
        status = 'ended',
        ends_at = now(),
        paused_remaining_seconds = 0,
        updated_at = now()
    WHERE id = 1;

    INSERT INTO public.audit_logs (event_type, severity, message)
    VALUES ('contest_lifecycle', 'info', 'Contest ended by admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.add_overtime(p_minutes INT DEFAULT 5)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ends_at TIMESTAMPTZ;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    UPDATE public.contest_state
    SET 
        ends_at = CASE 
            WHEN ends_at IS NOT NULL AND ends_at > now() THEN ends_at + (p_minutes || ' minutes')::INTERVAL
            ELSE now() + (p_minutes || ' minutes')::INTERVAL
        END,
        updated_at = now()
    WHERE id = 1
    RETURNING ends_at INTO v_ends_at;

    INSERT INTO public.audit_logs (event_type, severity, message)
    VALUES ('contest_lifecycle', 'info', format('Admin granted +%s minutes overtime to contest clock', p_minutes));

    RETURN v_ends_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_leaderboard_freeze(p_freeze BOOLEAN DEFAULT true)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    IF p_freeze THEN
        TRUNCATE TABLE public.leaderboard_snapshot;

        INSERT INTO public.leaderboard_snapshot (
            team_id,
            name,
            best_score,
            best_score_at,
            tab_switch_count,
            rank,
            frozen_at
        )
        SELECT 
            t.id,
            t.name,
            t.best_score,
            t.best_score_at,
            t.tab_switch_count,
            ROW_NUMBER() OVER (
                ORDER BY t.best_score DESC, t.best_score_at ASC NULLS LAST, t.created_at ASC
            )::INT AS rank,
            now()
        FROM public.teams t
        WHERE t.status = 'active';

        UPDATE public.contest_state
        SET leaderboard_frozen = true, updated_at = now()
        WHERE id = 1;

        INSERT INTO public.audit_logs (event_type, severity, message)
        VALUES ('leaderboard_freeze', 'warning', 'Public leaderboard frozen. Snapshot captured for participants.');
    ELSE
        TRUNCATE TABLE public.leaderboard_snapshot;

        UPDATE public.contest_state
        SET leaderboard_frozen = false, updated_at = now()
        WHERE id = 1;

        INSERT INTO public.audit_logs (event_type, severity, message)
        VALUES ('leaderboard_unfreeze', 'info', 'Public leaderboard unfrozen. Realtime scores restored.');
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_broadcast(p_message TEXT, p_priority TEXT DEFAULT 'normal')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrator privileges required';
    END IF;

    INSERT INTO public.broadcasts (message, priority, active)
    VALUES (p_message, p_priority, true)
    RETURNING id INTO v_id;

    UPDATE public.contest_state
    SET current_broadcast = p_message, updated_at = now()
    WHERE id = 1;

    INSERT INTO public.audit_logs (event_type, severity, message)
    VALUES ('broadcast_sent', 'info', format('Broadcast [%s]: %s', p_priority, p_message));

    RETURN v_id;
END;
$$;

-- 4.6 AGGREGATES & BONUS QUESTION RPCs
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

GRANT EXECUTE ON FUNCTION public.get_contest_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inject_bonus_question(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_join_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- 5.1 ADMINS
CREATE POLICY "Admins have full access to admins"
ON public.admins FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5.2 TEAMS
CREATE POLICY "Admins have full access to teams"
ON public.teams FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Members can view own team"
ON public.teams FOR SELECT TO anon, authenticated
USING (public.is_admin() OR public.is_team_member(id));

-- 5.3 TEAM MEMBERS
CREATE POLICY "Admins have full access to team members"
ON public.team_members FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Members can view members of own team"
ON public.team_members FOR SELECT TO anon, authenticated
USING (public.is_team_member(team_id));

-- 5.4 TEAM JOIN ATTEMPTS
CREATE POLICY "Admins have full access to join attempts"
ON public.team_join_attempts FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5.5 QUESTIONS
CREATE POLICY "Admins have full access to questions"
ON public.questions FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Participants can view live questions"
ON public.questions FOR SELECT TO anon, authenticated
USING (status = 'live');

-- 5.6 QUESTION SECRETS
-- Zero participant access. Admins and Service Role only.
CREATE POLICY "Admins have full access to question secrets"
ON public.question_secrets FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5.7 CONTEST STATE
CREATE POLICY "Admins have full access to contest state"
ON public.contest_state FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Anyone can view contest state"
ON public.contest_state FOR SELECT TO anon, authenticated
USING (true);

-- 5.8 BROADCASTS
CREATE POLICY "Admins have full access to broadcasts"
ON public.broadcasts FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Anyone can view active broadcasts"
ON public.broadcasts FOR SELECT TO anon, authenticated
USING (active = true);

-- 5.9 AUDIT LOGS
-- Audit logs are strictly admin-only. Zero participant or anon access.
CREATE POLICY "Admins only access audit logs"
ON public.audit_logs FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5.10 LEADERBOARD SNAPSHOT
CREATE POLICY "Admins have full access to leaderboard snapshot"
ON public.leaderboard_snapshot FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Participants can read leaderboard snapshot when frozen"
ON public.leaderboard_snapshot FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.contest_state WHERE leaderboard_frozen = true));

-- 5.11 ATTEMPTS
CREATE POLICY "Admins have full access to attempts"
ON public.attempts FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Members can view own team attempts"
ON public.attempts FOR SELECT TO anon, authenticated
USING (public.is_team_member(team_id));

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

-- ==============================================================================
-- 6. REALTIME REPLICATION PUBLICATION
-- ==============================================================================
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.team_members REPLICA IDENTITY FULL;
ALTER TABLE public.questions REPLICA IDENTITY FULL;
ALTER TABLE public.contest_state REPLICA IDENTITY FULL;
ALTER TABLE public.broadcasts REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
ALTER TABLE public.attempts REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contest_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attempts;
