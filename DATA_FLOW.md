# Prompt Arena // Comprehensive Data-Flow Audit

This document provides an end-to-end mapping of data flows, security boundaries, database queries, RPCs, row-level security (RLS) enforcement, and Realtime WebSocket subscriptions across both the **Super Admin Portal** and the **Participant Battle Pod**.

---

## 1. Architectural Overview & Security Model

The system follows a zero-trust model between contestants and the database:
- **Super Admins**: Authenticated via Supabase Auth with rows verified against `public.admins`. Possess full read/write privileges via `is_admin() = true`.
- **Participants**: Authenticate anonymously via `auth.signInAnonymously()` when joining a team with an 8-character code.
- **Outsiders / Public Anonymous**: Possess minimal privileges. Can read public contest state and active broadcasts. Blocked from viewing team rosters, attempts, audit logs, and question secrets.
- **Edge Functions / Evaluator**: Service role (`service_role`) evaluates test cases and writes verified scores and actual outputs to `public.attempts`.

---

## 2. End-to-End Screen & Route Data Matrix

### 2.1 Super Admin Portal (`/admin`)

| Screen / Component | Route / Tab | Data Read (Table / Columns / RPC) | Data Written / Mutated | Target Table / RPC | Role Required | Realtime Subscriptions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Login** (`AdminLoginView.tsx`) | `/admin` (unauthenticated) | `admins` (`id`, `email`) | `auth.signInWithPassword` | `auth.users` | Registered Admin | None |
| **Dashboard** (`DashboardView.tsx`) | `/admin` (`dashboard`) | `contest_state` (`*`), `teams` (`*`), `questions` (`*`), `broadcasts` (`*`), `audit_logs` (`*`) | Start / Pause / Resume, Broadcast dispatch | `start_contest`, `pause_contest`, `resume_contest`, `send_broadcast` | Super Admin | `arena-admin-telemetry` (`contest_state`, `teams`, `team_members`, `broadcasts`, `audit_logs`) |
| **Teams Management** (`TeamsView.tsx`) | `/admin` (`teams`) | `teams` (`*` including `join_code`), `team_members` (`*`) | Create, Bulk Create, Reg Code, Lock, Kick, DQ | `create_team`, `bulk_create_teams`, `regenerate_join_code`, `toggle_join_lock`, `kick_team_member`, `disqualify_team` | Super Admin | `arena-admin-telemetry` |
| **Question Bank** (`QuestionsView.tsx`) | `/admin` (`questions-bank`) | `questions` (`*`), `question_secrets` (`question_id`, `expected_output`) | Insert new challenge, Release bonus question | `questions.insert`, `question_secrets.insert`, `inject_bonus_question` | Super Admin | `arena-admin-telemetry` |
| **Admin Leaderboard** (`LeaderboardView.tsx`) | `/admin` (`leaderboard`) | `teams` (`id`, `name`, `best_score`, `best_score_at`, `tab_switch_count`, `status`), `contest_state` (`leaderboard_frozen`) | Toggle freeze | `toggle_leaderboard_freeze` | Super Admin | `arena-admin-telemetry` |
| **Arena Controls** (`ControlsView.tsx`) | `/admin` (`arena-controls`) | `contest_state` (`*`), `teams` (`*`) | Start, Pause, Resume, End, Overtime, Freeze, Broadcast | `start_contest`, `pause_contest`, `resume_contest`, `end_contest`, `add_overtime`, `toggle_leaderboard_freeze`, `send_broadcast` | Super Admin | `arena-admin-telemetry` |
| **Audit Logs** (`AuditLogView.tsx`) | `/admin` (`system-audit-log`) | `audit_logs` (`id`, `event_type`, `team_id`, `team_name`, `severity`, `message`, `metadata`, `created_at`) | Read-only | None | Super Admin | `arena-admin-telemetry` |

---

### 2.2 Participant Battle Pod (`/`, `/play`)

| Screen / Component | Route / Tab | Data Read (Table / Columns / RPC) | Data Written / Mutated | Target Table / RPC | Role Required | Realtime Subscriptions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Pod Login** (`ParticipantLoginView.tsx`) | `/` (unauthenticated) | `teams` (`*` for own team only after join) | Anonymous Auth, Join Team RPC | `auth.signInAnonymously()`, `rpc('join_team')` | Anon Participant | None |
| **Battle Arena** (`ParticipantArenaView.tsx`) | `/` (`battle-arena`) | `questions` (`*` where `status = 'live'`), `contest_state` (`*`), `attempts` (`*` where `team_id = my_team`) | Record attempt, Increment tab switch | `attempts.insert` (`score: 0, passed: false, actual_output: null`), `rpc('increment_tab_switch')` | Team Member | `participant-lobby-presence`, `participant-telemetry-feed` |
| **Participant Leaderboard** (`ParticipantLeaderboardView.tsx`) | `/` (`leaderboard`) | `rpc('get_leaderboard')`, `rpc('get_contest_stats')` | Read-only (RPCs respect freeze state; zero direct table queries) | None | Anon / Participant | `participant-telemetry-feed` |
| **API Key Config** (`ParticipantConfigView.tsx`) | `/` (`api-key-config`) | In-memory React state | None (Zero persistence to localStorage / Supabase) | Local State | Team Member | None |
| **Quest Log / Standby** (`ParticipantStandbyView.tsx`) | `/` (`quest-log`) | `questions` (`*`), `attempts` (`*` for own team) | Read-only | None | Team Member | `participant-telemetry-feed` |
| **Emergency Overlays** (`EmergencyOverlays.tsx`) | Overlay modal | `contest_state` (`status`, `leaderboard_frozen`), `team.status` (`disqualified`) | Read-only | None | Team Member | `participant-telemetry-feed` |

---

## 3. Database Table & RLS Policy Matrix

| Table Name | RLS Enabled | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `public.admins` | **YES** | `is_admin()` only | None (Direct insert blocked; managed via seed/auth) | None | None |
| `public.teams` | **YES** | `is_admin() OR is_team_member(id)` (No reading other teams) | Super Admin only | Super Admin only (Direct mutation by participants blocked) | Super Admin only |
| `public.team_members` | **YES** | `is_admin() OR is_team_member(team_id)` | Super Admin or `join_team` RPC | `is_admin()` only | `is_admin()` or RPC |
| `public.questions` | **YES** | `is_admin() OR status = 'live'` (Locked questions hidden) | Super Admin only | Super Admin only | Super Admin only |
| `public.question_secrets` | **YES** | `is_admin()` only (Expected output strictly hidden) | Super Admin only | Super Admin only | Super Admin only |
| `public.attempts` | **YES** | `is_admin() OR is_team_member(team_id)` | `is_team_member(team_id) AND contest_state.running AND question.live AND score=0 AND passed=false AND actual_output IS NULL` | Super Admin / Service Role only | Super Admin only |
| `public.contest_state` | **YES** | `true` (Publicly readable) | Super Admin only | Super Admin only | Super Admin only |
| `public.broadcasts` | **YES** | `is_admin() OR active = true` | Super Admin only | Super Admin only | Super Admin only |
| `public.audit_logs` | **YES** | `is_admin()` only (Participants/anon completely blocked) | `is_admin() OR SECURITY DEFINER functions` | Super Admin only | Super Admin only |
| `public.leaderboard_snapshot`| **YES** | `is_admin() OR contest_state.leaderboard_frozen = true` | Super Admin only | Super Admin only | Super Admin only |

---

## 4. Database RPC Security & Privilege Matrix

| Function Name | Security Definer | Permitted Callers | Purpose & Security Checks |
| :--- | :--- | :--- | :--- |
| `join_team(code, display_name)` | **YES** | Authenticated / Anon | Joins team via 8-char code. Enforces 5 failed attempts rate limit lockout. Verifies team is not full, locked, or disqualified. |
| `increment_tab_switch()` | **YES** | Team Members only | Logs tab switch in `team_members` and `audit_logs`. Rejects if contest is paused/not running or caller has no team. |
| `get_leaderboard()` | **YES** | Public (Anon / Authenticated)| Returns leaderboard rankings. Strips `join_code`. Returns frozen snapshot if `leaderboard_frozen = true`. |
| `get_contest_stats()` | **YES** | Public (Anon / Authenticated)| Returns active team count and total attempts count without exposing table rows. |
| `start_contest(p_duration_minutes)`| **YES** | `is_admin()` only | Sets contest running, computes `ends_at`, logs to audit log. |
| `pause_contest()` | **YES** | `is_admin()` only | Freezes remaining seconds, sets status to `paused`. |
| `resume_contest()` | **YES** | `is_admin()` only | Resumes timer from paused remaining seconds. |
| `end_contest()` | **YES** | `is_admin()` only | Halts contest, records final timestamps. |
| `add_overtime(p_minutes)` | **YES** | `is_admin()` only | Extends `ends_at` by N minutes. |
| `toggle_leaderboard_freeze(p_freeze)`| **YES**| `is_admin()` only | Freezes standings; takes snapshot into `leaderboard_snapshot`. |
| `send_broadcast(p_message, priority)`| **YES**| `is_admin()` only | Inserts active broadcast and updates `contest_state.current_broadcast`. |
| `create_team(p_name, p_max_members)`| **YES** | `is_admin()` only | Generates unique team and join code. |
| `bulk_create_teams(p_count, ...)` | **YES** | `is_admin()` only | Batch provisions teams with formatted names and join codes. |
| `regenerate_join_code(p_team_id)` | **YES** | `is_admin()` only | Generates fresh join code for specified team. |
| `toggle_join_lock(p_team_id, p_locked)`|**YES**| `is_admin()` only | Prevents any new contestants from joining the team. |
| `kick_team_member(p_team_id, ...)`| **YES** | `is_admin()` only | Removes a contestant from a team and adjusts tab switch tallies. |
| `disqualify_team(p_team_id)` | **YES** | `is_admin()` only | Flags team as disqualified; locks out attempt submissions. |
| `inject_bonus_question(p_question_id)`|**YES**| `is_admin()` only | Unlocks a question to `live` status and logs to audit trail. |

---

## 5. Realtime Channels & WebSocket Architecture

| Channel Name | Channel Type | Events Subscribed | Handlers / Component State Updates |
| :--- | :--- | :--- | :--- |
| `arena-admin-telemetry` | Postgres Changes | `contest_state` (`*`), `teams` (`*`), `team_members` (`*`), `broadcasts` (`*`), `audit_logs` (`INSERT`) | Triggers state sync in `ArenaContext` for instant dashboard and team roster updates. |
| `participant-lobby-presence`| Presence | `presence.sync` | Tracks online pods in real-time. Increments/decrements `onlinePodsCount` in header. |
| `participant-telemetry-feed` | Postgres Changes | `contest_state` (`*`), `questions` (`*`), `broadcasts` (`INSERT`) | Triggers timer updates, freeze notifications, question releases, and audio broadcast alerts. |

---

## 6. Dev Console Query Logger

A dev-only query interceptor is configured in `src/lib/supabase.ts` that triggers when `import.meta.env.DEV === true`.
It intercepts calls to `supabase.from()` and `supabase.rpc()`, printing formatted diagnostic lines:

- **Read Operations**: `%c[SUPABASE READ]%c table (columns)`
- **Mutation Operations**: `%c[SUPABASE MUTATION]%c table.action`
- **RPC Calls**: `%c[SUPABASE RPC]%c function(arguments)`

This guarantees full visibility into every network interaction as operators navigate the application.
