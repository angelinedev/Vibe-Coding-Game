# PROJECT AUDIT — Prompt Arena: Vibe Coding Contest Platform
**Audit Date:** 2026-10-19
**Auditor:** Antigravity AI (Read-only inspection — NO code was modified)
**Commit state:** HEAD of workspace at time of audit

---

## 1. ENVIRONMENT CHECK

### What Supabase is the app pointing at?

| Item | Finding |
|---|---|
| VITE_SUPABASE_URL | NOT SET — No .env or .env.local file exists in the project root |
| VITE_SUPABASE_ANON_KEY | NOT SET — Same reason |
| Fallback in src/lib/supabase.ts | Falls back to https://mock.supabase.co / mock-key when env vars are absent |
| isSupabaseConfigured flag | Returns false in current state — frontend runs in mock mode |

**Conclusion: The frontend is disconnected from Supabase when run without a .env.local file. All data reads silently no-op.**

### Is the local Supabase backend reachable?

supabase status confirms:
- Local Supabase IS running at http://127.0.0.1:54321
- Linked to remote project mgflhsdwabhontyldzkq (project name: Vibe-Coding)
- Some services are stopped: imgproxy, edge_runtime, pooler

### Are all migrations applied?

| Migration | Local | Remote | Status |
|---|---|---|---|
| 20261011000001_schema.sql | Yes | Yes | Applied |
| 20261011000002_seed.sql | Yes | Yes | Applied |
| 20261011000003_security_lockdown.sql | Yes | NO | NOT applied to remote |

> **CRITICAL:** The security lockdown migration has never been pushed to the linked remote project. The remote database is operating without hardened RLS, get_contest_stats() RPC, inject_bonus_question() RPC, and the email-signup rejection trigger.

### Is the admins table populated?
Cannot confirm on remote without service-role access. Locally: the seed migration (20261011000002) does NOT insert an admin — admin provisioning is manual.

### Are Edge Functions deployed?
No supabase/functions/ directory exists. No Edge Functions are defined or deployed. The verify-attempt flow does not exist.

### Does npm run build pass?
YES. Clean build, exit code 0:
- 95 modules transformed
- dist/assets/index.css  46.69 kB (gzip: 7.84 kB)
- dist/assets/index.js  622.24 kB (gzip: 153.95 kB)
- Built in 2.98s
Warning: Single JS chunk > 500 kB threshold. No code splitting applied.

### Does npm run dev start?
App compiles. Without a .env.local pointing to Supabase, it starts in mock/disconnected mode.

---

## 2. FEATURE RATINGS

### 2.1 Routing / Navigation — WORKING
- App.tsx: manual path-based routing via window.location.pathname and history.pushState
- /admin prefix ? admin portal (login-gated)
- Everything else ? participant portal
- Back/forward navigation via popstate listener
- Evidence: src/App.tsx L17-L152

### 2.2 Admin Login — PARTIAL
- Calls supabase.auth.signInWithPassword() then verifies row in public.admins (correct pattern)
- Issue: No .env.local ? isSupabaseConfigured is false ? login silently fails
- Issue: No admin provisioning UI or script
- Evidence: src/pages/AdminLoginView.tsx L36-L100

### 2.3 Participant Login (Join Team) — PARTIAL
- Flow: signInAnonymously() ? rpc('join_team') ? fetch team row ? localStorage
- Issue: No .env.local ? returns "Supabase backend is not configured" immediately
- Issue: member object is built locally with synthesized id (crypto.randomUUID()), not the actual DB row id
- Evidence: src/context/ParticipantContext.tsx L360-L418

### 2.4 Admin Pages

**Dashboard — WORKING (when Supabase configured)**
All numbers from real data. Empty state: "NO TEAMS REGISTERED YET". Realtime via postgres_changes.

**Teams View — WORKING (when Supabase configured)**
create_team, bulk_create_teams, regenerate_join_code, toggle_join_lock, kick_team_member, disqualify_team — all backed by real RPCs.

**Questions View — WORKING (when Supabase configured)**
Create: questions.insert + question_secrets.insert. inject_bonus_question RPC used to go-live.

**Leaderboard View — WORKING (when Supabase configured)**
Reads teams table (admin can see all via RLS). Freeze toggle wired.

**Controls View — WORKING (when Supabase configured)**
start_contest, pause_contest, resume_contest, end_contest, add_overtime RPCs. Timer from contestState.ends_at.

**Audit Log View — WORKING (when Supabase configured)**
Admin-only via RLS. Realtime push on INSERT events.

### 2.5 Participant Pages

**Participant Login — PARTIAL** (see 2.3)

**Standby / Quest Log — PARTIAL**
Shows contest state and broadcasts. Realtime subscriptions wired. Empty states exist.

**Participant Arena (Battle Pod) — BROKEN (core loop)**

Evaluation flow breakdown:
1. Participant writes prompt
2. Frontend calls Gemini API directly from browser with in-memory key
3. Gemini returns text; frontend compares vs question.expected_output
4. CRITICAL FLAW: questions table has NO expected_output column — it is in question_secrets. RLS blocks participants from question_secrets. So question.expected_output is always undefined.
5. When expected_output is empty, isSuccess = true (ParticipantContext.tsx L567). EVERY EVALUATION PASSES REGARDLESS OF CORRECTNESS.
6. Attempt recorded with hardcoded passed: false, score: 0 (L617-618). Score never updates.
- Evidence: src/context/ParticipantContext.tsx L562-L622

**Participant Leaderboard — WORKING (when Supabase configured)**
Uses get_leaderboard() RPC — freeze-aware, no join_code exposure.

**Participant Config (API Key) — WORKING**
In-memory only, never persisted. Probe test calls Gemini API directly.

### 2.6 Dummy Data Sweep — WORKING
- No fake team names (0xByteNinja, PromptKnights, etc.) in src/
- No hardcoded demo join codes (ARENA-8080, ARENA-7749)
- No setTimeout-based fake results
- Math.random() only in generateLocalJoinCode() utility
- seed_dev.sql properly isolated
- Cosmetic string "TICK RATE: 60Hz" in ParticipantPortal.tsx L44 — flavour text

### 2.7 Realtime — PARTIAL
Admin: arena-admin-telemetry subscribes to contest_state, teams, team_members, broadcasts, audit_logs. Correct.
Participant: participant-telemetry-feed subscribes to contest_state, questions, broadcasts. Correct.
Presence: participant-lobby-presence for onlinePodsCount. Correct.
MISSING: No realtime subscription to participant's own teams row or attempts table. DQ status won't push immediately.

### 2.8 Security — PARTIAL (Critical gap on remote)
Local (migration 003 applied):
- Teams RLS: participants see only own team row
- audit_logs: admin-only
- question_secrets: admin-only
- attempts insert: locked to team member + contest running + question live
- get_leaderboard() RPC: freeze-aware, no join_code exposure
- get_contest_stats() RPC: safe aggregate
- Email signup rejection trigger

Remote (migration 003 NOT applied):
- Old loose policies still in effect
- get_contest_stats() RPC does not exist on remote
- Email signup rejection trigger does not exist on remote
- Participants could potentially read all teams data

### 2.9 UI / Visual Quality — WORKING
- Consistent arcade/retro design: Press Start 2P, VT323, Space Mono, Courier Prime
- Pixel grid background, scanline overlay, arcade shadows, blink animations
- Material Symbols icons, responsive layouts, proper empty states, dark mode
- Minor: "TICK RATE: 60Hz" static flavour text, "© 2025" placeholder year

### 2.10 Code Health — PARTIAL
Strengths: TypeScript throughout, SECURITY DEFINER RPCs, dev logger gated behind DEV flag, realtime cleanup in useEffect returns.

Issues:
- No .env.local / .env.example — cannot connect without manual setup
- INITIAL_QUESTIONS in src/lib/supabase.ts L122-L149 exposes expected_output values in the frontend bundle (answers to Q1 and Q2 visible in DevTools)
- ParticipantContext.tsx L263: activeRunResult in refreshParticipantData deps causes full re-fetch on every evaluation
- ArenaContext.tsx L69: questions initialized with INITIAL_QUESTIONS — admin sees hardcoded questions briefly before Supabase loads
- Single 622 kB JS bundle, no code splitting
- No error boundary components
- No loading skeleton states

### 2.11 Event Readiness — BROKEN
Blockers:
1. No .env.local ? app in mock mode
2. Migration 003 not on remote ? security holes
3. Evaluation always passes, score always 0
4. No Edge Function for server-side scoring
5. No admin provisioning script

---

## 3. SCOREBOARD

| # | Feature | Rating | Evidence |
|---|---|---|---|
| 1 | Routing | WORKING | src/App.tsx |
| 2 | Admin Login | PARTIAL | Missing .env.local |
| 3 | Participant Login | PARTIAL | Missing .env.local, member.id mismatch |
| 4 | Admin Dashboard | PARTIAL | Works when Supabase configured |
| 5 | Admin Teams | PARTIAL | Works when Supabase configured |
| 6 | Admin Questions | PARTIAL | Works when Supabase configured |
| 7 | Admin Leaderboard | PARTIAL | Works when Supabase configured |
| 8 | Admin Controls | PARTIAL | Works when Supabase configured |
| 9 | Admin Audit Log | PARTIAL | Works when Supabase configured |
| 10 | Participant Arena (Eval) | BROKEN | expected_output always empty ? always PASS, score 0 |
| 11 | Participant Leaderboard | PARTIAL | Works when Supabase configured |
| 12 | Participant Config | WORKING | In-memory key, probe test real |
| 13 | Realtime (Admin) | PARTIAL | Subscriptions correct, no .env = no connection |
| 14 | Realtime (Participant) | PARTIAL | Missing own-team and attempts subscription |
| 15 | Dummy Data | WORKING | Cleaned. One cosmetic string remains |
| 16 | Security (local) | WORKING | Migration 003 hardens all tables |
| 17 | Security (remote) | BROKEN | Migration 003 never pushed to remote |
| 18 | UI Quality | WORKING | Strong arcade aesthetic |
| 19 | Build | WORKING | npm run build exits 0 |
| 20 | Event Readiness | BROKEN | Multiple blockers |

---

## 4. TOP 10 PROBLEMS (ranked by severity)

### P1 [RED] — Missing .env.local: App runs in mock mode
**File:** Project root (missing)
**Impact:** Entire app disconnected from Supabase. No admin login, no participant join, no data.
**Fix:** Create .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from supabase status output. Add .env.example as template.

---

### P2 [RED] — Migration 003 not applied to remote database
**File:** supabase/migrations/20261011000003_security_lockdown.sql — remote: unapplied
**Impact:** Hardened RLS, get_contest_stats() RPC, inject_bonus_question() RPC, and email-signup rejection trigger are absent on remote. Participants could read all team data.
**Fix:** Run: supabase db push

---

### P3 [RED] — Evaluation always passes; score always 0
**File:** src/context/ParticipantContext.tsx L562-L622
**Impact:** question.expected_output is always undefined for participants (stored in question_secrets, RLS blocked). evaluatePrompt() defaults to isSuccess = true when expected_output is empty. Attempt recorded with hardcoded passed: false, score: 0. Leaderboard stays at 0 for everyone.
**Fix:** Create a Supabase Edge Function (verify-attempt) that reads question_secrets via service role, compares output, and updates attempts + team score server-side.

---

### P4 [RED] — expected_output exposed in frontend bundle
**File:** src/lib/supabase.ts L122-L149
**Impact:** INITIAL_QUESTIONS contains correct expected outputs ('olleH dlroW morf gnidoC ebiV', '100'). Anyone can read answers in DevTools.
**Fix:** Remove expected_output from INITIAL_QUESTIONS. This field must never appear in client-side code.

---

### P5 [ORANGE] — member.id synthesized locally after join
**File:** src/context/ParticipantContext.tsx L396-L407
**Impact:** After join_team RPC, localMember uses id: crypto.randomUUID(). Actual team_members row has a different UUID. Any code using member.id to identify the DB row will fail.
**Fix:** After RPC success, fetch actual row: supabase.from('team_members').select('*').eq('user_id', user.id).single()

---

### P6 [ORANGE] — No admin provisioning path
**File:** No file — missing feature
**Impact:** admins table must be populated manually. No UI, script, or migration provisions the first admin.
**Fix:** Add supabase/provision_admin.sql script or document steps clearly in README.

---

### P7 [ORANGE] — No Supabase Edge Function for verification
**File:** supabase/functions/ — directory does not exist
**Impact:** Design requires server-side verification against question_secrets. P3 fix depends on this.
**Fix:** Create supabase/functions/verify-attempt/index.ts that accepts { teamId, questionId, actualOutput }, reads question_secrets, compares, updates attempts.passed + attempts.score, returns result.

---

### P8 [YELLOW] — Participant realtime for own team row missing
**File:** src/context/ParticipantContext.tsx L290-L315
**Impact:** DQ status change won't push immediately to participant — only on next refreshParticipantData poll.
**Fix:** Add postgres_changes subscription on teams table filtered by id = team.id.

---

### P9 [YELLOW] — activeRunResult in refreshParticipantData deps causes excessive re-fetches
**File:** src/context/ParticipantContext.tsx L263
**Impact:** Every evaluation triggers a full data refresh (all tables). Under load with 50 teams this causes unnecessary DB spikes.
**Fix:** Remove activeRunResult from the useCallback dependency array.

---

### P10 [YELLOW] — No code splitting; 622 kB single JS bundle
**File:** vite.config.ts
**Impact:** All pages load together. Slower first paint. Matters on Wi-Fi with 50 simultaneous connections.
**Fix:** Add build.rollupOptions.output.manualChunks to split Supabase vendor from app code.

---

## 5. RECOMMENDED BUILD ORDER

Before the event, execute in this order:

1. [ENV]      Create .env.local with local Supabase credentials (fixes P1)
2. [SECURITY] Apply migration 003 to remote: supabase db push (fixes P2)
3. [SECURITY] Remove expected_output from INITIAL_QUESTIONS in supabase.ts (fixes P4)
4. [ADMIN]    Provision admin user via Supabase Studio or psql (fixes P6)
5. [BACKEND]  Create supabase/functions/verify-attempt Edge Function (fixes P7)
6. [BUG]      Wire evaluatePrompt to call verify-attempt instead of comparing locally (fixes P3)
7. [BUG]      Fix member.id: fetch real team_members row after join_team RPC (fixes P5)
8. [REALTIME] Add postgres_changes subscription to own teams row in ParticipantContext (fixes P8)
9. [PERF]     Remove activeRunResult from refreshParticipantData deps (fixes P9)
10. [PERF]    Add vite code splitting (optional for event) (fixes P10)
11. [OPS]     Create .env.example for documentation
12. [OPS]     Run supabase db reset + seed_dev.sql for local testing
13. [VERIFY]  Run security_check.mjs against local Supabase to confirm 65/65 pass
14. [VERIFY]  Test full end-to-end: create team, join, submit prompt, verify score updates

---

## 6. SUMMARY

The project has a solid, well-designed architecture with real Supabase RPCs, proper RLS groundwork, and a strong arcade UI. The primary issues are:
- Operational: no .env.local (P1)
- Security-critical: migration 003 not pushed to remote (P2)
- Architectural: evaluation core loop broken because score comparison happens client-side without access to question_secrets (P3)

**Bottom line: This platform cannot run a fair contest in its current state. P1, P2, and P3 must be resolved before the event.**
