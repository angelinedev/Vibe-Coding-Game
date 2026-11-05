export type TeamStatus = 'active' | 'disqualified';
export type QuestionStatus = 'locked' | 'live' | 'closed';
export type ContestStatus = 'not_started' | 'running' | 'paused' | 'ended';
export type BroadcastPriority = 'normal' | 'flash' | 'alert';
export type AuditSeverity = 'info' | 'warning' | 'critical';
export type QuestionTier = 'EASY' | 'MEDIUM' | 'HARD' | 'BOSS';

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  display_name: string;
  tab_switch_count: number;
  joined_at: string;
  last_seen_at: string;
}

export interface Team {
  id: string;
  name: string;
  join_code: string;
  max_members: number;
  join_locked: boolean;
  status: TeamStatus;
  tab_switch_count: number;
  best_score: number;
  best_score_at: string | null;
  created_at: string;
  last_seen_at: string | null;
  is_online?: boolean;
  members?: TeamMember[];
}

export interface Question {
  id: string;
  title: string;
  description: string;
  input_data: string;
  max_points: number;
  order_index: number;
  status: QuestionStatus;
  tier: QuestionTier;
  category: string;
  is_bonus?: boolean;
  created_at: string;
  expected_output?: string; // Only present in admin views or creation
  testcases?: import('../lib/testcases').TestCase[];
}

export interface ContestState {
  id: number;
  status: ContestStatus;
  ends_at: string | null;
  paused_remaining_seconds: number | null;
  leaderboard_frozen: boolean;
  current_broadcast: string | null;
  updated_at: string;
}

export interface Broadcast {
  id: string;
  message: string;
  priority: BroadcastPriority;
  active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  event_type: string;
  team_id?: string | null;
  team_name?: string | null;
  user_id?: string | null;
  severity: AuditSeverity;
  message: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Attempt {
  id: string;
  team_id: string;
  user_id?: string | null;
  question_id: string;
  prompt: string;
  generated_code?: string | null;
  actual_output?: string | null;
  passed: boolean;
  score: number;
  created_at: string;
}
