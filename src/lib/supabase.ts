import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Team, Question, ContestState, AuditLog, Broadcast, TeamMember } from '../types/database';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const missingEnvVars: string[] = [];
if (!rawUrl || rawUrl === 'https://your-project.supabase.co' || rawUrl === 'https://your-project-ref.supabase.co') {
  missingEnvVars.push('VITE_SUPABASE_URL');
}
if (!rawAnonKey || rawAnonKey === 'your-anon-key' || rawAnonKey === 'your-anon-key-here') {
  missingEnvVars.push('VITE_SUPABASE_ANON_KEY');
}

export const isSupabaseConfigured = missingEnvVars.length === 0;

// When unconfigured, provide a strict fail-fast client stub to prevent silent mock runs
const unconfiguredClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (prop === 'auth') {
      return {
        getSession: async () => ({ data: { session: null }, error: new Error('Backend not configured') }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => {},
      };
    }
    return () => {
      throw new Error(
        `[SUPABASE_NOT_CONFIGURED] Cannot access supabase.${String(prop)}: Missing required env vars (${missingEnvVars.join(', ')}). App must not run disconnected.`
      );
    };
  },
});

const rawClient: SupabaseClient = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : unconfiguredClient;

// Dev-only query & mutation logger
function attachDevLogger(client: SupabaseClient): SupabaseClient {
  if (!import.meta.env.DEV) return client;

  const originalFrom = client.from.bind(client);
  const originalRpc = client.rpc.bind(client);

  client.from = ((relation: string) => {
    const builder = originalFrom(relation);

    const origSelect = builder.select.bind(builder);
    builder.select = ((columns?: string, ...rest: any[]) => {
      console.log(
        `%c[SUPABASE READ]%c ${relation} (${columns || '*'})`,
        'color: #38bdf8; font-weight: bold; background: #0f172a; padding: 2px 4px; border-radius: 2px;',
        'color: #cbd5e1;'
      );
      return (origSelect as any)(columns, ...rest);
    }) as any;

    const origInsert = builder.insert.bind(builder);
    builder.insert = ((values: any, ...rest: any[]) => {
      console.log(
        `%c[SUPABASE MUTATION]%c ${relation}.insert`,
        'color: #f43f5e; font-weight: bold; background: #0f172a; padding: 2px 4px; border-radius: 2px;',
        'color: #cbd5e1;',
        values
      );
      return (origInsert as any)(values, ...rest);
    }) as any;

    const origUpdate = builder.update.bind(builder);
    builder.update = ((values: any, ...rest: any[]) => {
      console.log(
        `%c[SUPABASE MUTATION]%c ${relation}.update`,
        'color: #fb923c; font-weight: bold; background: #0f172a; padding: 2px 4px; border-radius: 2px;',
        'color: #cbd5e1;',
        values
      );
      return (origUpdate as any)(values, ...rest);
    }) as any;

    const origDelete = builder.delete.bind(builder);
    builder.delete = ((...rest: any[]) => {
      console.log(
        `%c[SUPABASE MUTATION]%c ${relation}.delete`,
        'color: #ef4444; font-weight: bold; background: #0f172a; padding: 2px 4px; border-radius: 2px;',
        'color: #cbd5e1;'
      );
      return (origDelete as any)(...rest);
    }) as any;

    const origUpsert = builder.upsert.bind(builder);
    builder.upsert = ((values: any, ...rest: any[]) => {
      console.log(
        `%c[SUPABASE MUTATION]%c ${relation}.upsert`,
        'color: #e879f9; font-weight: bold; background: #0f172a; padding: 2px 4px; border-radius: 2px;',
        'color: #cbd5e1;',
        values
      );
      return (origUpsert as any)(values, ...rest);
    }) as any;

    return builder;
  }) as any;

  client.rpc = ((fn: string, args?: any, ...rest: any[]) => {
    console.log(
      `%c[SUPABASE RPC]%c ${fn}(${args ? JSON.stringify(args) : ''})`,
      'color: #4ade80; font-weight: bold; background: #0f172a; padding: 2px 4px; border-radius: 2px;',
      'color: #cbd5e1;'
    );
    return originalRpc(fn, args, ...rest);
  }) as any;

  return client;
}

export const supabase: SupabaseClient = attachDevLogger(rawClient);

// ------------------------------------------------------------------------------
// Production Defaults: Clean empty initial state
// ------------------------------------------------------------------------------
export const INITIAL_CONTEST_STATE: ContestState = {
  id: 1,
  status: 'not_started',
  ends_at: null,
  paused_remaining_seconds: null,
  leaderboard_frozen: false,
  current_broadcast: null,
  updated_at: new Date().toISOString(),
};

// Clean empty arrays for event readiness
export const INITIAL_TEAMS: Team[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
export const INITIAL_BROADCASTS: Broadcast[] = [];
