# Vibe Coding Contest Portal — Supabase Backend Foundation

A production-grade, highly secure Supabase database architecture and **Super Admin Portal** designed for a college **"Vibe Coding" Prompt-Engineering Contest** (~50 concurrent teams).

---

## 1. Architecture Overview

```
                      +-----------------------------------+
                      |       SUPER ADMIN (Dashboard)     |
                      |   auth.users -> public.admins     |
                      +-----------------+-----------------+
                                        | (Full CRUD & Control RPCs)
                                        v
+-----------------------------------------------------------------------------------+
|                               SUPABASE POSTGRES DB                                |
|                                                                                   |
|  [public.contest_state] <---+                                                     |
|         |                   |                                                     |
|         v                   |                                                     |
|  [public.questions]         | (Triggers on freeze)                                |
|         |                   |                                                     |
|         +---> [public.question_secrets]  (HIDDEN: expected_output)                |
|                                                                                   |
|  [public.teams] <-----------+                                                     |
|         ^                   |                                                     |
|         | (1:N join_code)   | (Triggers on member tab switch & attempt scoring)   |
|  [public.team_members]      |                                                     |
|         ^                   |                                                     |
|         |                   |                                                     |
|  [public.attempts] ---------+                                                     |
|                                                                                   |
|  [public.leaderboard_snapshot] <--- (Frozen rankings snapshot)                    |
|  [public.leaderboard]          <--- (View & RPC: get_leaderboard())               |
+-----------------------------------------------------------------------------------+
       ^                                    ^                        ^
       | (Anonymous Auth + join_code)       | (Output Verifier)      | (Realtime Stream)
       |                                    |                        |
+------+----------------------+   +---------+-----------+   +--------+-------------+
|    PARTICIPANT BROWSER      |   |   EDGE FUNCTIONS    |   | REALTIME TELEMETRY   |
| - Gemini API Key held in    |   | - Only compares     |   | - Live teams roster  |
|   client memory only        |   |   code output vs    |   | - Live leaderboard   |
| - Up to 3 devices/members   |   |   question_secrets  |   | - Broadcast notices  |
|   per team join code        |   | - Never touches     |   | - Proctor tab audit  |
| - RPC: join_team(code, name)|   |   Gemini API keys   |   +----------------------+
+-----------------------------+   +---------------------+
```

### Core Security & Architectural Principles
1. **Multi-Device Team Rosters via Join Codes**: Each team has a unique 8-character join code (unambiguous alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, formatted `ARENA-XXXX`). Up to 3 contestants can join the same team from different devices using Anonymous Auth. The `join_team(code, display_name)` RPC validates codes and enforces rate-limiting (locks after 5 failed attempts in 5 minutes).
2. **Ground-Truth Secrecy**: The ground-truth `expected_output` is isolated in `public.question_secrets`. No participant has any read policy on this table. Only super admins and the backend Edge Function (`service_role` key) can access it.
3. **Client-Side Gemini API Keys Only**: Gemini API keys are entered by each participant directly in their browser and held in memory only. They are **never sent to the database, never sent to any Edge Function, and never logged**. The only backend Edge Function needed is code-output verification (comparing code execution output against `question_secrets`).
4. **Cumulative Contest Scoring**: Total score is the sum of each team's highest score per question. When attempts are scored, an automatic PostgreSQL trigger updates `teams.best_score` and `teams.best_score_at` strictly if the cumulative score increases.
5. **Freeze-Aware Leaderboard**: When `contest_state.leaderboard_frozen = true`, participants automatically receive a static snapshot captured in `public.leaderboard_snapshot`. Super admins always see the live leaderboard.
6. **Per-Member Tab Switching with Team Aggregation**: Tab switch events must be reported through the `increment_tab_switch()` RPC function, which verifies caller identity and increments the member's `tab_switch_count`. A PostgreSQL trigger automatically synchronizes the team's total tab switch count.

---

## 2. Database Schema Summary

| Table | Description | Access Rules |
| :--- | :--- | :--- |
| `admins` | Super admins referencing `auth.users(id)` and email | Admins only |
| `teams` | Contestant teams (`id`, `name`, `join_code`, `max_members`, `join_locked`, `status`, `tab_switch_count`, `best_score`) | Public read for leaderboard; Admins full |
| `team_members` | Contestants belonging to teams (`team_id`, `user_id = auth.uid()`, `display_name`, `tab_switch_count`) | Select members of own team; Admins full |
| `team_join_attempts` | Rate-limiting audit log for join code attempts | Admins full; insert during `join_team()` |
| `questions` | Contest questions (input data, points, status, tier, category, bonus) — *no secret output* | Select `live` questions only; Admins full |
| `question_secrets` | Expected ground-truth output for each question | **Admins & Service Role only** (Zero participant access) |
| `contest_state` | Singleton state (status, timer, broadcast marquee, freeze flag) | Read-only for all; Admins full |
| `broadcasts` | Realtime arena broadcast notices and flash messages | Read active for all; Admins full |
| `audit_logs` | System and proctor telemetry log stream (severity, tab switches, lifecycle) | Read for all; Admins full |
| `leaderboard_snapshot` | Frozen snapshot of ranks and scores captured during freeze | Read when frozen; Admins full |
| `attempts` | Team prompt submissions, generated code, and scores | Select own team, Insert own when live & running; Admins full |

---

## 3. How to Run Migrations

### Production Migrations (`supabase/migrations/`)
1. [`supabase/migrations/20261011000001_schema.sql`](supabase/migrations/20261011000001_schema.sql): Foundation schema, `team_members`, join codes, triggers, RLS, Realtime publication.
2. [`supabase/migrations/20261011000002_seed.sql`](supabase/migrations/20261011000002_seed.sql): Initial contest state singleton (`not_started`) and starter questions (Q-01, Q-02).

### Option A: Using the Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Link to your Supabase project**:
   ```bash
   supabase link --project-ref your-project-id
   ```

3. **Push migrations to remote database**:
   ```bash
   supabase db push
   ```

### Option B: Using the Supabase Dashboard SQL Editor
1. Open your project on the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor**.
3. Sequentially create new queries, paste the contents, and click **Run** for:
   - `supabase/migrations/20261011000001_schema.sql`
   - `supabase/migrations/20261011000002_seed.sql`

---

## 4. Development & Event Reset Utilities

- **`supabase/seed_dev.sql`**: Run manually **only for testing and development**. Seeds 50 test teams with join codes, sample members, extra challenge questions (Q-03 to Q-06), sample audit logs, and test broadcasts.
- **`supabase/reset_for_event.sql`**: Run before your live contest. Wipes all teams, team members, attempts, audit logs, broadcasts, and leaderboard snapshots, and resets `contest_state` to `'not_started'`. Keeps schema, admins, questions, and secrets intact.

---

## 5. Running the React + Vite + Tailwind Admin Web App

The application features the complete **PROMPT ARENA // ARCADE CONTROL v1.0** Super Admin interface:
- **DASHBOARD**: Master HUD telemetry, teams proctor monitoring matrix table, search, proctor flag filters, action modals.
- **TEAMS**: Create team, bulk-generate N teams, copy join codes, lock/unlock join codes, regenerate codes, kick members, and export all codes as CSV for printing.
- **QUESTIONS**: Question bank with difficulty tiers, live status, + Forge Question modal (saves secrets into `question_secrets`), and bonus question injection.
- **LEADERBOARD**: Top 3 arcade podium showcase (#1 Gold, #2 Silver, #3 Bronze), detailed score matrix, CSV export, and freeze public toggle.
- **CONTROLS**: Match clock (Start, Pause, Resume, End, +5M Overtime), one-tap flash broadcast presets, and custom marquee announcer.
- **AUDIT LOG**: Realtime system & proctor event stream with severity filters and JSON metadata inspector.

### Start Locally
```bash
# Install dependencies
npm install

# Run Vite dev server
npm run dev
```
Navigate to `http://localhost:5173` (or `http://localhost:5174`).

### Connecting to Live Supabase
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://mgflhsdwabhontyldzkq.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 6. Super Admin & Auth Configuration Guide

### 6.1 Hosted Supabase Setup

#### Step 1: Configure Authentication Settings in Supabase Dashboard
1. **Enable Anonymous Sign-Ins** (Required for Participants):
   - Go to **Authentication -> Providers -> Anonymous**.
   - Toggle **Enable Anonymous Sign-Ins** to **ON**.
   - Click **Save**.
2. **Disable Public Email Signups** (Prevents unauthorized user registrations):
   - Go to **Authentication -> Providers -> Email**.
   - Toggle **Allow new users to sign up** to **OFF** (or uncheck "Enable Signup").
   - This ensures all participant contestants use anonymous join tokens, and administrators can only be invited or created manually by existing operators.
3. **Ensure Email Confirmations Do Not Block Admins**:
   - In **Authentication -> Providers -> Email**, verify **Confirm email** is handled properly. When manually creating admin users (Step 2), always check **Auto Confirm User**.

#### Step 2: Create the Administrator Account in Supabase Auth
1. Navigate to **Authentication -> Users** in the Supabase Dashboard.
2. Click **Add User -> Create User**.
3. Enter your administrator email (e.g., `admin@contest.college.edu`) and a strong, complex password.
4. Ensure the **Auto Confirm User?** toggle is checked (so the user is immediately active without an email round-trip).
5. Click **Create User**.

#### Step 3: Provision Super Admin Privileges via SQL Script
Open the **SQL Editor** in the Supabase Dashboard, load [`supabase/provision_admin.sql`](file:///c:/Users/angel/OneDrive/Desktop/cookin/Vibe-Coding/supabase/provision_admin.sql), and run:

```sql
DO $$
DECLARE
    target_email TEXT := 'admin@contest.college.edu'; -- <-- Replace with your admin email
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE lower(email) = lower(trim(target_email));

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User "%" not found in auth.users.', target_email;
    END IF;

    -- Insert into public.admins (referenced by is_admin() RLS checks)
    INSERT INTO public.admins (id, email, created_at)
    VALUES (target_user_id, lower(trim(target_email)), NOW())
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;

    -- Tag app metadata to ensure admin bypass for internal triggers
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_admin_provisioned": true}'::jsonb
    WHERE id = target_user_id;

    RAISE NOTICE 'SUCCESS: User "%" (ID: %) successfully registered in public.admins.', target_email, target_user_id;
END;
$$;
```

#### Step 4: Adding Co-Organizers / Multiple Admins
To provision additional co-organizers or contest judges:
1. Repeat **Step 2** to create their account in **Authentication -> Users**.
2. Run the provisioning script in **Step 3** with their respective email.
3. Every user listed in `public.admins` inherits full operator capabilities (team management, live problem broadcasts, timer pauses, score freeze).

---

### 6.2 Local Development Parity (`supabase/config.toml`)

To match this configuration locally during Docker development, verify `supabase/config.toml`:

```toml
[auth]
enabled = true
enable_anonymous_sign_ins = true

[auth.email]
enable_signup = false
enable_confirmations = false

[auth.anonymous_users]
enabled = true
```

---

## 7. Row Level Security (RLS) Policy Guide

RLS is enabled on every table:

- **`admins`**: Restricts management strictly to existing super admins via `is_admin()`.
- **`teams`**: Admins have full access. Public read access enabled for leaderboard display.
- **`team_members`**: Admins full access. Contestants can view members of their own team via `is_team_member(team_id)`.
- **`team_join_attempts`**: Admins full access. Inserted automatically during `join_team()` RPC.
- **`questions`**: Admins full access. Participants can only view questions where `status = 'live'`.
- **`question_secrets`**: **Admins & Service Role only**. Zero participant read access.
- **`contest_state`**: Admins full access. Public read-only.
- **`broadcasts`**: Admins full access. Participants can view where `active = true`.
- **`audit_logs`**: Admins full access. Participants can view stream.
- **`leaderboard_snapshot`**: Admins full access. Participants can read when `contest_state.leaderboard_frozen = true`.
- **`attempts`**: Admins full access. Contestants can view own team attempts and insert attempts during active contest for live questions.

---

## 8. Realtime Configuration

The following tables are added to the `supabase_realtime` publication with `REPLICA IDENTITY FULL`:
- `teams`
- `team_members`
- `questions`
- `contest_state`
- `broadcasts`
- `audit_logs`
- `attempts`

---

## 9. RPC Reference

### Participant RPCs
```javascript
// 1. Join a team using join code and display name (rate-limited)
const { data, error } = await supabase.rpc('join_team', {
  code: 'ARENA-W9X2-K7M4',
  display_name: 'Alex Chen'
});

// 2. Report a tab switch (increments contestant count & cascades to team sum)
const { data: teamSwitches, error } = await supabase.rpc('increment_tab_switch');

// 3. Fetch leaderboard (returns frozen snapshot if contest is frozen)
const { data: leaderboard, error } = await supabase.rpc('get_leaderboard');
```

### Super Admin RPCs
```sql
-- 1. Create a single team
SELECT public.create_team('ByteCrushers', 3);

-- 2. Bulk-create N teams
SELECT public.bulk_create_teams(10, 'Team', 3);

-- 3. Regenerate join code
SELECT public.regenerate_join_code('TEAM-UUID-HERE');

-- 4. Toggle join lock
SELECT public.toggle_join_lock('TEAM-UUID-HERE', true);

-- 5. Kick team member
SELECT public.kick_team_member('TEAM-UUID-HERE', 'MEMBER-UUID-HERE');

-- 6. Disqualify team
SELECT public.disqualify_team('TEAM-UUID-HERE');

-- 7. Match timer controls
SELECT public.start_contest(90);
SELECT public.pause_contest();
SELECT public.resume_contest();
SELECT public.add_overtime(5);
SELECT public.end_contest();

-- 8. Freeze leaderboard
SELECT public.toggle_leaderboard_freeze(true);
SELECT public.toggle_leaderboard_freeze(false);

-- 9. Send broadcast announcement
SELECT public.send_broadcast('10 MINUTES REMAINING!', 'flash');
```

---

## 7. Local vs Hosted Setup

### Option A: Local Development (Default Docker / Supabase CLI)
1. Ensure Docker Desktop is running.
2. Start the local Supabase container cluster:
   ```bash
   npx supabase start
   ```
3. Copy the output API URL and anon key into `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://mgflhsdwabhontyldzkq.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```

### Option B: Hosted Supabase Project
To connect the frontend to your hosted Supabase project:
1. Open your Supabase Dashboard: `https://supabase.com/dashboard/project/<your-project-ref>`
2. In the left navigation menu, click **Project Settings** (the gear icon at the bottom).
3. In the settings submenu, click **API** (or **API Keys**).
4. Retrieve the credentials:
   - **Project URL**: In the "Project URL" / "Configuration" card, copy the URL (e.g. `https://mgflhsdwabhontyldzkq.supabase.co`). Set this as `VITE_SUPABASE_URL`.
   - **Publishable Key (Anon)**: In the "API Keys" section, look for **Publishable key** (named `default`, starting with `sb_publishable_...`) or under "Legacy anon, service_role API keys" look for `anon public`. Copy this key. Set this as `VITE_SUPABASE_ANON_KEY`.
   - ⚠️ **SECURITY WARNING**: NEVER copy the **Secret key** (`sb_secret_...`) or `service_role` key into `.env.local` or frontend code. Doing so would bypass all Row Level Security and compromise the database.
5. Create or edit `.env.local` in the project root:
   ```env
   VITE_SUPABASE_URL=https://mgflhsdwabhontyldzkq.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```
6. Start the frontend:
   ```bash
   npm run dev
   ```
   If any required environment variable is missing, the app will refuse to start silently and will render a full-screen `[BACKEND NOT CONFIGURED]` error screen.

