import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function report(testName, blocked, detail = '') {
  totalTests++;
  if (blocked) {
    passedTests++;
    console.log(`  PASS (blocked)     | ${testName}${detail ? ' [' + detail + ']' : ''}`);
  } else {
    failedTests++;
    console.log(`  FAIL (got through) | ${testName}${detail ? ' [' + detail + ']' : ''}`);
  }
}

async function runSecuritySuite() {
  console.log('========================================================================');
  console.log('        PROMPT ARENA // SECURITY ATTACK SIMULATION SUITE');
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // 0. TEST FIXTURES SETUP (via service_role)
  // ---------------------------------------------------------------------------
  console.log('[SETUP] Provisioning test environment...');

  // Create an admin user in auth.users + public.admins (from env or dynamic fixture)
  const adminEmail = process.env.ADMIN_EMAIL || `test_admin_${Date.now()}@internal.test`;
  const adminPassword = process.env.ADMIN_PASSWORD || `TestPass_${Date.now()}_!A9`;
  const { data: adminAuth, error: adminAuthErr } = await serviceClient.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    app_metadata: { is_admin_provisioned: true }
  });
if (adminAuthErr) throw new Error('Failed to create test admin: ' + adminAuthErr.message);
const adminId = adminAuth.user.id;
await serviceClient.from('admins').insert({ id: adminId, email: adminEmail });

// Clean up any previous test teams to make test suite idempotent
const testCodes = ['ALPHA001', 'BRAVO002', 'FULL0001', 'LOCK0001', 'DQ000001'];
await serviceClient.from('teams').delete().in('join_code', testCodes);

// Create Team Alpha (target team) and Team Bravo (victim team)
const { data: teamA, error: errA } = await serviceClient.from('teams').insert({
  name: `Team Alpha ${Date.now()}`,
  join_code: 'ALPHA001',
  max_members: 3,
  status: 'active'
}).select().single();
if (errA) throw new Error('Failed to create Team Alpha: ' + errA.message);

const { data: teamB, error: errB } = await serviceClient.from('teams').insert({
  name: `Team Bravo ${Date.now()}`,
  join_code: 'BRAVO002',
  max_members: 3,
  status: 'active'
}).select().single();
if (errB) throw new Error('Failed to create Team Bravo: ' + errB.message);

// Create Full Team, Locked Team, and Disqualified Team
const { data: teamFull } = await serviceClient.from('teams').insert({
  name: `Team Full ${Date.now()}`,
  join_code: 'FULL0001',
  max_members: 1,
  status: 'active'
}).select().single();

const { data: teamLocked } = await serviceClient.from('teams').insert({
  name: `Team Locked ${Date.now()}`,
  join_code: 'LOCK0001',
  max_members: 3,
  join_locked: true,
  status: 'active'
}).select().single();

const { data: teamDQ } = await serviceClient.from('teams').insert({
  name: `Team DQ ${Date.now()}`,
  join_code: 'DQ000001',
  max_members: 3,
  status: 'disqualified'
}).select().single();

// Create a locked (non-live) question
const { data: lockedQ } = await serviceClient.from('questions').insert({
  title: 'Secret Locked Question',
  description: 'Not yet available to contestants',
  input_data: 'classified',
  max_points: 500,
  order_index: 99,
  status: 'locked'
}).select().single();

// Fetch the starter live question
const { data: liveQ } = await serviceClient.from('questions').select().eq('status', 'live').limit(1).single();

// Reset contest state to 'running' for test scenarios
await serviceClient.from('contest_state').update({
  status: 'running',
  leaderboard_frozen: false
}).eq('id', 1);

// ---------------------------------------------------------------------------
// 1. SETUP ACTORS
// Actor 1: memberClient (Anonymous user joined to Team Alpha)
// Actor 2: outsiderClient (Anonymous user NOT in any team)
// ---------------------------------------------------------------------------
const memberClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const { data: memberAnon } = await memberClient.auth.signInAnonymously();
const memberUid = memberAnon.user.id;
const joinRes = await memberClient.rpc('join_team', { code: 'ALPHA001', display_name: 'Pilot_Alpha' });
if (joinRes.error) throw new Error('Failed to join Team Alpha: ' + joinRes.error.message);

// Also fill teamFull with an initial member
const dummyClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
await dummyClient.auth.signInAnonymously();
await dummyClient.rpc('join_team', { code: 'FULL0001', display_name: 'Occupant' });

// Outsider Client (Signed in anonymously, NO team joined)
const outsiderClient = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const { data: outsiderAnon } = await outsiderClient.auth.signInAnonymously();
const outsiderUid = outsiderAnon.user.id;

console.log(`[SETUP] Actors ready:`);
console.log(`  - Team Alpha Member UID: ${memberUid} (Team ID: ${teamA.id})`);
console.log(`  - Outsider Contestant UID: ${outsiderUid} (No Team)`);
console.log(`  - Victim Team Bravo ID: ${teamB.id}\n`);

// ===========================================================================
// CATEGORY 1: INFORMATION DISCLOSURE & PRIVACY ATTACKS
// ===========================================================================
console.log('--- [CATEGORY 1: DATA LEAKAGE & PRIVACY ATTACKS] ---');

// 1.1 Read question_secrets
{
  const { data: secMember, error: err1 } = await memberClient.from('question_secrets').select('*');
  report('1.1 Read question_secrets as team member', (!secMember || secMember.length === 0) || Boolean(err1));

  const { data: secOutsider, error: err2 } = await outsiderClient.from('question_secrets').select('*');
  report('1.2 Read question_secrets as outsider', (!secOutsider || secOutsider.length === 0) || Boolean(err2));
}

// 1.2 Read other teams and join codes
{
  // Member tries to read Team Bravo
  const { data: teamsMember } = await memberClient.from('teams').select('*').eq('id', teamB.id);
  report('1.3 Read other team (Team Bravo) directly as team member', !teamsMember || teamsMember.length === 0);

  // Member tries to query join_code of all teams
  const { data: allTeamsMember } = await memberClient.from('teams').select('id, name, join_code');
  const leakedBravoCode = allTeamsMember?.some(t => t.id === teamB.id || t.join_code === 'BRAVO002');
  report('1.4 Read join_code of other teams directly', !leakedBravoCode, `Returned ${allTeamsMember?.length || 0} teams (only own team allowed)`);

  // Outsider tries to read teams
  const { data: allTeamsOutsider } = await outsiderClient.from('teams').select('*');
  report('1.5 Read teams table directly as outsider', !allTeamsOutsider || allTeamsOutsider.length === 0);

  // Verify get_leaderboard() RPC does NOT leak join_code
  const { data: leaderboardData } = await memberClient.rpc('get_leaderboard');
  const hasJoinCodeProp = leaderboardData?.some(row => 'join_code' in row);
  report('1.6 Inspect get_leaderboard() for leaked join_code', !hasJoinCodeProp && leaderboardData?.length > 0);
}

// 1.3 Read other teams' team_members and attempts
{
  const { data: membersMember } = await memberClient.from('team_members').select('*').eq('team_id', teamB.id);
  report('1.7 Read Team Bravo team_members as Team Alpha member', !membersMember || membersMember.length === 0);

  const { data: membersOutsider } = await outsiderClient.from('team_members').select('*');
  report('1.8 Read team_members table as outsider', !membersOutsider || membersOutsider.length === 0);

  const { data: attemptsMember } = await memberClient.from('attempts').select('*').eq('team_id', teamB.id);
  report('1.9 Read Team Bravo attempts as Team Alpha member', !attemptsMember || attemptsMember.length === 0);

  const { data: attemptsOutsider } = await outsiderClient.from('attempts').select('*');
  report('1.10 Read attempts table as outsider', !attemptsOutsider || attemptsOutsider.length === 0);
}

// 1.4 Read audit_logs, admins table, inactive broadcasts
{
  const { data: auditMember, error: aErr1 } = await memberClient.from('audit_logs').select('*');
  report('1.11 Read audit_logs as team member', (!auditMember || auditMember.length === 0) || Boolean(aErr1));

  const { data: auditOutsider, error: aErr2 } = await outsiderClient.from('audit_logs').select('*');
  report('1.12 Read audit_logs as outsider', (!auditOutsider || auditOutsider.length === 0) || Boolean(aErr2));

  const { data: adminsMember, error: admErr1 } = await memberClient.from('admins').select('*');
  report('1.13 Read admins table as team member', (!adminsMember || adminsMember.length === 0) || Boolean(admErr1));

  const { data: adminsOutsider, error: admErr2 } = await outsiderClient.from('admins').select('*');
  report('1.14 Read admins table as outsider', (!adminsOutsider || adminsOutsider.length === 0) || Boolean(admErr2));

  // Secret/inactive broadcast read test
  const { data: inactiveBcast } = await serviceClient.from('broadcasts').insert({
    message: 'CLASSIFIED ADMIN NOTICE',
    priority: 'alert',
    active: false
  }).select().single();

  const { data: bcastMember } = await memberClient.from('broadcasts').select('*').eq('id', inactiveBcast.id);
  report('1.15 Read inactive/admin broadcast as team member', !bcastMember || bcastMember.length === 0);

  const { data: bcastOutsider } = await outsiderClient.from('broadcasts').select('*').eq('id', inactiveBcast.id);
  report('1.16 Read inactive/admin broadcast as outsider', !bcastOutsider || bcastOutsider.length === 0);
}

// ===========================================================================
// CATEGORY 2: PRIVILEGE ESCALATION (ADMIN RPCS)
// ===========================================================================
console.log('\n--- [CATEGORY 2: CALLING ADMIN RPCS (PRIVILEGE ESCALATION)] ---');

const adminRpcAttacks = [
  { name: 'create_team', params: { p_name: 'Hacker Team', p_max_members: 3 } },
  { name: 'bulk_create_teams', params: { p_count: 5, p_name_prefix: 'HACK', p_max_members: 3 } },
  { name: 'regenerate_join_code', params: { p_team_id: teamB.id } },
  { name: 'toggle_join_lock', params: { p_team_id: teamB.id, p_locked: true } },
  { name: 'kick_team_member', params: { p_team_id: teamB.id, p_member_id: crypto.randomUUID() } },
  { name: 'disqualify_team', params: { p_team_id: teamB.id } },
  { name: 'start_contest', params: { p_duration_minutes: 60 } },
  { name: 'pause_contest', params: {} },
  { name: 'resume_contest', params: {} },
  { name: 'end_contest', params: {} },
  { name: 'add_overtime', params: { p_minutes: 10 } },
  { name: 'toggle_leaderboard_freeze', params: { p_freeze: true } },
  { name: 'send_broadcast', params: { p_message: 'Hacked broadcast message', p_priority: 'alert' } },
  { name: 'inject_bonus_question', params: { p_question_id: lockedQ.id } },
];

for (const attack of adminRpcAttacks) {
  const { error: errMember } = await memberClient.rpc(attack.name, attack.params);
  const blockedMember = Boolean(errMember && (
    errMember.message.includes('Administrator privileges required') ||
    errMember.message.includes('Access denied')
  ));
  report(`2.x Call admin RPC [${attack.name}] as team member`, blockedMember, errMember?.message);

  const { error: errOutsider } = await outsiderClient.rpc(attack.name, attack.params);
  const blockedOutsider = Boolean(errOutsider && (
    errOutsider.message.includes('Administrator privileges required') ||
    errOutsider.message.includes('Access denied')
  ));
  report(`2.x Call admin RPC [${attack.name}] as outsider`, blockedOutsider, errOutsider?.message);
}

// ===========================================================================
// CATEGORY 3: UNAUTHORIZED DIRECT MUTATIONS
// ===========================================================================
console.log('\n--- [CATEGORY 3: DIRECT TABLE MUTATIONS] ---');

// 3.1 Directly UPDATE teams.best_score or teams.status
{
  const { data: updScore, error: errScore } = await memberClient
    .from('teams')
    .update({ best_score: 999999 })
    .eq('id', teamA.id)
    .select();
  report('3.1 Direct UPDATE teams.best_score', !updScore || updScore.length === 0, errScore?.message);

  const { data: updStatus, error: errStatus } = await memberClient
    .from('teams')
    .update({ status: 'active' })
    .eq('id', teamDQ.id)
    .select();
  report('3.2 Direct UPDATE teams.status (reinstate disqualified team)', !updStatus || updStatus.length === 0, errStatus?.message);

  const { data: updTab, error: errTab } = await memberClient
    .from('team_members')
    .update({ tab_switch_count: 0 })
    .eq('user_id', memberUid)
    .select();
  report('3.3 Direct UPDATE team_members.tab_switch_count', !updTab || updTab.length === 0, errTab?.message);

  const { data: insAdminMember, error: errAdmIns1 } = await memberClient
    .from('admins')
    .insert({ id: memberUid, email: 'fakeadmin@hacked.com' })
    .select();
  report('3.4 Direct INSERT into admins as team member', (!insAdminMember || insAdminMember.length === 0) || Boolean(errAdmIns1));

  const { data: insAdminOutsider, error: errAdmIns2 } = await outsiderClient
    .from('admins')
    .insert({ id: outsiderUid, email: 'fakeadmin2@hacked.com' })
    .select();
  report('3.5 Direct INSERT into admins as outsider', (!insAdminOutsider || insAdminOutsider.length === 0) || Boolean(errAdmIns2));
}

// ===========================================================================
// CATEGORY 4: ATTEMPTS INTEGRITY & SPOOFING ATTACKS
// ===========================================================================
console.log('\n--- [CATEGORY 4: ATTEMPTS SUBMISSION INTEGRITY] ---');

// 4.1 Insert attempt with pre-filled score, passed, or actual_output
{
  const { error: errScore } = await memberClient.from('attempts').insert({
    team_id: teamA.id,
    user_id: memberUid,
    question_id: liveQ.id,
    prompt: 'Hacked prompt',
    score: 100,
    passed: false
  });
  report('4.1 INSERT attempt with pre-filled score=100', Boolean(errScore));

  const { error: errPassed } = await memberClient.from('attempts').insert({
    team_id: teamA.id,
    user_id: memberUid,
    question_id: liveQ.id,
    prompt: 'Hacked prompt',
    score: 0,
    passed: true
  });
  report('4.2 INSERT attempt with pre-filled passed=true', Boolean(errPassed));

  const { error: errOutput } = await memberClient.from('attempts').insert({
    team_id: teamA.id,
    user_id: memberUid,
    question_id: liveQ.id,
    prompt: 'Hacked prompt',
    score: 0,
    passed: false,
    actual_output: 'Pre-filled output'
  });
  report('4.3 INSERT attempt with pre-filled actual_output', Boolean(errOutput));

  // Outsider trying to insert an attempt (even with score 0) must be blocked
  const { error: errOutsiderAttempt } = await outsiderClient.from('attempts').insert({
    team_id: teamA.id,
    user_id: outsiderUid,
    question_id: liveQ.id,
    prompt: 'Outsider injected prompt',
    score: 0,
    passed: false,
    actual_output: null
  });
  report('4.4 INSERT attempt as outsider with no team', Boolean(errOutsiderAttempt), errOutsiderAttempt?.message);
}

// 4.2 Insert attempt for another team
{
  const { error: errOtherTeam } = await memberClient.from('attempts').insert({
    team_id: teamB.id,
    user_id: memberUid,
    question_id: liveQ.id,
    prompt: 'Sabotage prompt',
    score: 0,
    passed: false
  });
  report('4.5 INSERT attempt for another team (Team Bravo)', Boolean(errOtherTeam));
}

// 4.3 Insert attempt for non-live question
{
  const { error: errLockedQ } = await memberClient.from('attempts').insert({
    team_id: teamA.id,
    user_id: memberUid,
    question_id: lockedQ.id,
    prompt: 'Locked Q prompt',
    score: 0,
    passed: false
  });
  report('4.6 INSERT attempt for locked/non-live question', Boolean(errLockedQ));
}

// 4.4 Insert attempt when contest is not running
{
  // Pause contest
  await serviceClient.from('contest_state').update({ status: 'paused' }).eq('id', 1);
  const { error: errPaused } = await memberClient.from('attempts').insert({
    team_id: teamA.id,
    user_id: memberUid,
    question_id: liveQ.id,
    prompt: 'Paused prompt',
    score: 0,
    passed: false
  });
  report('4.7 INSERT attempt while contest is paused', Boolean(errPaused));

  // End contest
  await serviceClient.from('contest_state').update({ status: 'ended' }).eq('id', 1);
  const { error: errEnded } = await memberClient.from('attempts').insert({
    team_id: teamA.id,
    user_id: memberUid,
    question_id: liveQ.id,
    prompt: 'Ended prompt',
    score: 0,
    passed: false
  });
  report('4.8 INSERT attempt while contest is ended', Boolean(errEnded));

  // Reset back to running
  await serviceClient.from('contest_state').update({ status: 'running' }).eq('id', 1);
}

// 4.5 Insert attempt as a disqualified team
{
  await serviceClient.from('teams').update({ status: 'disqualified' }).eq('id', teamA.id);
  const { error: errDQ } = await memberClient.from('attempts').insert({
    team_id: teamA.id,
    user_id: memberUid,
    question_id: liveQ.id,
    prompt: 'DQ prompt',
    score: 0,
    passed: false
  });
  report('4.9 INSERT attempt as a disqualified team member', Boolean(errDQ));

  // Reinstate teamA for remaining tests
  await serviceClient.from('teams').update({ status: 'active' }).eq('id', teamA.id);
}

// ===========================================================================
// CATEGORY 5: TAB SWITCH & JOIN TEAM LOGIC
// ===========================================================================
console.log('\n--- [CATEGORY 5: TAB SWITCH & JOIN PROTOCOLS] ---');

// 5.1 Call increment_tab_switch as outsider (no team)
{
  const { error: errTabOutsider } = await outsiderClient.rpc('increment_tab_switch');
  report('5.1 increment_tab_switch() as outsider (not in any team)', Boolean(errTabOutsider), errTabOutsider?.message);
}

// 5.2 Call increment_tab_switch when contest is paused
{
  await serviceClient.from('contest_state').update({ status: 'paused' }).eq('id', 1);
  const { error: errTabPaused } = await memberClient.rpc('increment_tab_switch');
  report('5.2 increment_tab_switch() when contest is paused', Boolean(errTabPaused), errTabPaused?.message);
  await serviceClient.from('contest_state').update({ status: 'running' }).eq('id', 1);
}

// 5.3 Brute-force join_team with 6 wrong codes -> rate limit triggers
{
  const bruteClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  await bruteClient.auth.signInAnonymously();

  let rateLimitHit = false;
  for (let i = 1; i <= 6; i++) {
    const { data: bruteData, error: bruteErr } = await bruteClient.rpc('join_team', {
      code: `WRONG${i}`,
      display_name: 'BruteForcer'
    });
    if (
      (bruteErr && bruteErr.message.includes('Too many failed join attempts')) ||
      (bruteData?.error && bruteData.error.includes('Too many failed join attempts'))
    ) {
      rateLimitHit = true;
      break;
    }
  }
  report('5.3 Brute-force join_team rate-limit lockout after 5 failures', rateLimitHit);
}

// 5.4 Join team that is full, locked, or disqualified
{
  const joinAttacker = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  await joinAttacker.auth.signInAnonymously();

  const { error: errJoinFull } = await joinAttacker.rpc('join_team', {
    code: 'FULL0001',
    display_name: 'Attacker'
  });
  report('5.4 join_team on a full team', Boolean(errJoinFull && errJoinFull.message.includes('full')), errJoinFull?.message);

  const { error: errJoinLocked } = await joinAttacker.rpc('join_team', {
    code: 'LOCK0001',
    display_name: 'Attacker'
  });
  report('5.5 join_team on a join-locked team', Boolean(errJoinLocked && errJoinLocked.message.includes('locked')), errJoinLocked?.message);

  const { error: errJoinDQ } = await joinAttacker.rpc('join_team', {
    code: 'DQ000001',
    display_name: 'Attacker'
  });
  report('5.6 join_team on a disqualified team', Boolean(errJoinDQ && errJoinDQ.message.includes('disqualified')), errJoinDQ?.message);
}

// ===========================================================================
// CATEGORY 6: AUTHENTICATION ENFORCEMENT
// ===========================================================================
console.log('\n--- [CATEGORY 6: AUTH REGISTRATION LOCKDOWN] ---');

// 6.1 Public email sign-up rejected
{
  const publicClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: errSignUp } = await publicClient.auth.signUp({
    email: `intruder_${Date.now()}@attacker.com`,
    password: `IntruderPass_${Date.now()}!X9`
  });
  const blockedSignUp = Boolean(errSignUp && (
    errSignUp.message.toLowerCase().includes('disabled') ||
    errSignUp.message.toLowerCase().includes('not allowed') ||
    errSignUp.message.toLowerCase().includes('not authorized') ||
    errSignUp.message.toLowerCase().includes('database error')
  ));
  report('6.1 Public email signup via auth API', blockedSignUp, errSignUp?.message);
}

// ---------------------------------------------------------------------------
// SUMMARY SCOREBOARD
// ---------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`TOTAL ATTACKS TESTED: ${totalTests}`);
console.log(`PASSED (BLOCKED):     ${passedTests}`);
console.log(`FAILED (VULNERABLE):  ${failedTests}`);
console.log('========================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL SECURITY ATTACK VECTORS BLOCKED BY POSTGRES RLS & RPCS! [0 VULNERABILITIES]');
  process.exit(0);
}
}

runSecuritySuite().catch((err) => {
  console.error('Test suite runtime failure:', err);
  process.exit(1);
});
