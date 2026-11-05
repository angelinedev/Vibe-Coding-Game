import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Team, 
  TeamMember,
  Question, 
  ContestState, 
  AuditLog, 
  Broadcast 
} from '../types/database';
import { 
  supabase, 
  isSupabaseConfigured, 
  INITIAL_CONTEST_STATE, 
  INITIAL_TEAMS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_BROADCASTS
} from '../lib/supabase';
import { playSound } from '../lib/audio';

interface ArenaContextType {
  contestState: ContestState;
  teams: Team[];
  questions: Question[];
  isLoading: boolean;
  auditLogs: AuditLog[];
  broadcasts: Broadcast[];
  onlineCount: number;
  totalTeams: number;
  disqualifiedCount: number;
  topScore: number;
  topTeamName: string;
  isSFXMuted: boolean;
  isRealtimeConnected: boolean;
  selectedTeam: Team | null;
  setSelectedTeam: (team: Team | null) => void;
  
  // Contest Lifecycle
  startContest: (durationMinutes?: number) => Promise<void>;
  pauseContest: () => Promise<void>;
  resumeContest: () => Promise<void>;
  endContest: () => Promise<void>;
  addOvertime: (minutes?: number) => Promise<void>;
  toggleLeaderboardFreeze: (freeze?: boolean) => Promise<void>;
  sendBroadcast: (message: string, priority?: 'normal' | 'flash' | 'alert') => Promise<void>;
  clearBroadcast: () => Promise<void>;
  
  // Questions
  createQuestion: (newQ: Partial<Question> & { expected_output: string }) => Promise<void>;
  injectBonusQuestion: (questionId: string) => Promise<void>;
  lockQuestion: (questionId: string) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  
  // Teams & Join Codes
  createTeam: (name: string, maxMembers?: number) => Promise<Team | null>;
  bulkCreateTeams: (count: number, prefix?: string, maxMembers?: number) => Promise<number>;
  regenerateJoinCode: (teamId: string) => Promise<string>;
  toggleJoinLock: (teamId: string, locked?: boolean) => Promise<void>;
  kickTeamMember: (teamId: string, memberId: string) => Promise<void>;
  disqualifyTeam: (teamId: string) => Promise<void>;
  
  // Utilities
  toggleSFXMute: () => void;
  refreshData: () => Promise<void>;
}

const ArenaContext = createContext<ArenaContextType | null>(null);

export const ArenaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contestState, setContestState] = useState<ContestState>(INITIAL_CONTEST_STATE);
  const [teams, setTeams] = useState<Team[]>(INITIAL_TEAMS);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(INITIAL_BROADCASTS);
  const [isSFXMuted, setIsSFXMuted] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(isSupabaseConfigured);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Computed metrics directly from real data
  const onlineCount = teams.filter(t => t.is_online !== false && t.status !== 'disqualified').length;
  const totalTeams = teams.length;
  const disqualifiedCount = teams.filter(t => t.status === 'disqualified').length;
  const sortedTeams = [...teams].sort((a, b) => b.best_score - a.best_score);
  const topScore = sortedTeams[0]?.best_score || 0;
  const topTeamName = sortedTeams[0]?.name || 'No teams';

  // Fetch live Supabase data
  const refreshData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    try {
      const [stateRes, teamsRes, membersRes, questionsRes, logsRes, broadcastsRes] = await Promise.all([
        supabase.from('contest_state').select('*').single(),
        supabase.from('teams').select('*').order('best_score', { ascending: false }),
        supabase.from('team_members').select('*'),
        supabase.from('questions').select('*').order('order_index', { ascending: true }),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('broadcasts').select('*').order('created_at', { ascending: false }).limit(20)
      ]);

      if (stateRes.data) setContestState(stateRes.data as ContestState);
      
      if (teamsRes.data) {
        const membersMap = new Map<string, TeamMember[]>();
        if (membersRes.data) {
          (membersRes.data as TeamMember[]).forEach(m => {
            const list = membersMap.get(m.team_id) || [];
            list.push(m);
            membersMap.set(m.team_id, list);
          });
        }

        const assembledTeams: Team[] = (teamsRes.data as Team[]).map(t => ({
          ...t,
          members: membersMap.get(t.id) || []
        }));
        setTeams(assembledTeams);
      }

      if (questionsRes.data) setQuestions(questionsRes.data as Question[]);
      if (logsRes.data) setAuditLogs(logsRes.data as AuditLog[]);
      if (broadcastsRes.data) setBroadcasts(broadcastsRes.data as Broadcast[]);
    } catch (err) {
      console.warn('Could not load live Supabase data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Set up Supabase Realtime subscriptions
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('arena-admin-telemetry')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contest_state' }, (payload) => {
        if (payload.new) setContestState(payload.new as ContestState);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
        refreshData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, (payload) => {
        if (payload.new) {
          setBroadcasts(prev => [payload.new as Broadcast, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
        if (payload.new) {
          setAuditLogs(prev => [payload.new as AuditLog, ...prev.slice(0, 49)]);
        }
      })
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshData]);

  // ============================================================================
  // CONTEST LIFECYCLE ACTIONS
  // ============================================================================
  const startContest = async (durationMinutes: number = 90) => {
    playSound.start();
    if (isSupabaseConfigured) {
      await supabase.rpc('start_contest', { p_duration_minutes: durationMinutes });
    }
    const ends = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    setContestState(prev => ({
      ...prev,
      status: 'running',
      ends_at: ends,
      paused_remaining_seconds: null,
      updated_at: new Date().toISOString()
    }));
  };

  const pauseContest = async () => {
    playSound.click();
    if (isSupabaseConfigured) {
      await supabase.rpc('pause_contest');
    }
    const rem = contestState.ends_at 
      ? Math.max(0, Math.floor((new Date(contestState.ends_at).getTime() - Date.now()) / 1000))
      : 0;
    setContestState(prev => ({
      ...prev,
      status: 'paused',
      paused_remaining_seconds: rem,
      updated_at: new Date().toISOString()
    }));
  };

  const resumeContest = async () => {
    playSound.click();
    if (isSupabaseConfigured) {
      await supabase.rpc('resume_contest');
    }
    const rem = contestState.paused_remaining_seconds || 0;
    const ends = new Date(Date.now() + rem * 1000).toISOString();
    setContestState(prev => ({
      ...prev,
      status: 'running',
      ends_at: ends,
      paused_remaining_seconds: null,
      updated_at: new Date().toISOString()
    }));
  };

  const endContest = async () => {
    playSound.warning();
    if (isSupabaseConfigured) {
      await supabase.rpc('end_contest');
    }
    setContestState(prev => ({
      ...prev,
      status: 'ended',
      ends_at: new Date().toISOString(),
      paused_remaining_seconds: 0,
      updated_at: new Date().toISOString()
    }));
  };

  const addOvertime = async (minutes: number = 5) => {
    playSound.bonus();
    if (isSupabaseConfigured) {
      await supabase.rpc('add_overtime', { p_minutes: minutes });
    }
    const currentEnd = contestState.ends_at ? new Date(contestState.ends_at).getTime() : Date.now();
    const newEnd = new Date(Math.max(Date.now(), currentEnd) + minutes * 60 * 1000).toISOString();
    setContestState(prev => ({
      ...prev,
      ends_at: newEnd,
      updated_at: new Date().toISOString()
    }));
  };

  const toggleLeaderboardFreeze = async (freeze?: boolean) => {
    playSound.freeze();
    const target = freeze !== undefined ? freeze : !contestState.leaderboard_frozen;
    if (isSupabaseConfigured) {
      await supabase.rpc('toggle_leaderboard_freeze', { p_freeze: target });
    }
    setContestState(prev => ({
      ...prev,
      leaderboard_frozen: target,
      updated_at: new Date().toISOString()
    }));
  };

  const sendBroadcast = async (message: string, priority: 'normal' | 'flash' | 'alert' = 'normal') => {
    playSound.broadcast();
    if (isSupabaseConfigured) {
      await supabase.rpc('send_broadcast', { p_message: message, p_priority: priority });
    }
    const newB: Broadcast = {
      id: String(Date.now()),
      message,
      priority,
      active: true,
      created_at: new Date().toISOString()
    };
    setBroadcasts(prev => [newB, ...prev]);
    setContestState(prev => ({ ...prev, current_broadcast: message }));
  };

  // ============================================================================
  // QUESTION ACTIONS
  // ============================================================================
  const createQuestion = async (newQ: Partial<Question> & { expected_output: string }) => {
    playSound.click();
    const questionId = crypto.randomUUID();
    
    if (isSupabaseConfigured) {
      await supabase.from('questions').insert({
        id: questionId,
        title: newQ.title,
        description: newQ.description,
        input_data: newQ.input_data,
        max_points: newQ.max_points,
        order_index: questions.length + 1,
        status: newQ.status || 'live',
        tier: newQ.tier || 'MEDIUM',
        category: newQ.category || 'GENERAL',
        is_bonus: newQ.is_bonus || false,
      });

      await supabase.from('question_secrets').insert({
        question_id: questionId,
        expected_output: newQ.expected_output,
      });
    }

    const created: Question = {
      id: questionId,
      title: newQ.title || 'Untitled Challenge',
      description: newQ.description || '',
      input_data: newQ.input_data || '',
      expected_output: newQ.expected_output,
      max_points: newQ.max_points || 100,
      order_index: questions.length + 1,
      status: newQ.status || 'live',
      tier: newQ.tier || 'MEDIUM',
      category: newQ.category || 'GENERAL',
      is_bonus: newQ.is_bonus || false,
      created_at: new Date().toISOString(),
    };
    setQuestions(prev => [...prev, created]);
  };

  const injectBonusQuestion = async (questionId: string) => {
    playSound.bonus();
    if (isSupabaseConfigured) {
      await supabase.from('questions').update({ status: 'live' }).eq('id', questionId);
    }
    setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, status: 'live' } : q));
  };

  // ============================================================================
  // TEAM & JOIN CODE ACTIONS
  // ============================================================================
  const createTeam = async (name: string, maxMembers: number = 3): Promise<Team | null> => {
    playSound.click();
    if (!isSupabaseConfigured) throw new Error('Backend not configured');

    const { data, error } = await supabase.rpc('create_team', {
      p_name: name,
      p_max_members: maxMembers
    });
    if (error) {
      console.error('Failed to create team:', error);
      throw error;
    }
    await refreshData();
    return data as Team;
  };

  const bulkCreateTeams = async (count: number, prefix: string = 'Team', maxMembers: number = 3): Promise<number> => {
    playSound.click();
    if (!isSupabaseConfigured) throw new Error('Backend not configured');

    const { data, error } = await supabase.rpc('bulk_create_teams', {
      p_count: count,
      p_name_prefix: prefix,
      p_max_members: maxMembers
    });
    if (error) {
      console.error('Failed to bulk create teams:', error);
      throw error;
    }
    await refreshData();
    return (data as number) || count;
  };

  const regenerateJoinCode = async (teamId: string): Promise<string> => {
    playSound.click();
    if (!isSupabaseConfigured) throw new Error('Backend not configured');

    const { data, error } = await supabase.rpc('regenerate_join_code', { p_team_id: teamId });
    if (error) {
      console.error('Failed to regenerate join code:', error);
      throw error;
    }
    await refreshData();
    return data as string;
  };

  const toggleJoinLock = async (teamId: string, locked?: boolean) => {
    playSound.click();
    const current = teams.find(t => t.id === teamId)?.join_locked ?? false;
    const nextVal = locked !== undefined ? locked : !current;

    if (isSupabaseConfigured) {
      await supabase.rpc('toggle_join_lock', { p_team_id: teamId, p_locked: nextVal });
    }

    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, join_locked: nextVal } : t));
  };

  const kickTeamMember = async (teamId: string, memberId: string) => {
    playSound.warning();
    if (isSupabaseConfigured) {
      await supabase.rpc('kick_team_member', { p_team_id: teamId, p_member_id: memberId });
    }

    setTeams(prev => prev.map(t => {
      if (t.id === teamId && t.members) {
        const remaining = t.members.filter(m => m.id !== memberId);
        const newSwitches = remaining.reduce((acc, m) => acc + m.tab_switch_count, 0);
        return { ...t, members: remaining, tab_switch_count: newSwitches };
      }
      return t;
    }));
  };

  const disqualifyTeam = async (teamId: string) => {
    playSound.warning();
    if (isSupabaseConfigured) {
      await supabase.rpc('disqualify_team', { p_team_id: teamId });
    }
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, status: 'disqualified' } : t));
  };

  const toggleSFXMute = () => {
    setIsSFXMuted(prev => !prev);
  };

  return (
    <ArenaContext.Provider value={{
      contestState,
      teams,
      questions,
      isLoading,
      auditLogs,
      broadcasts,
      onlineCount,
      totalTeams,
      disqualifiedCount,
      topScore,
      topTeamName,
      isSFXMuted,
      isRealtimeConnected,
      selectedTeam,
      setSelectedTeam,
      
      startContest,
      pauseContest,
      resumeContest,
      endContest,
      addOvertime,
      toggleLeaderboardFreeze,
      sendBroadcast,
      
      createQuestion,
      injectBonusQuestion,
      
      createTeam,
      bulkCreateTeams,
      regenerateJoinCode,
      toggleJoinLock,
      kickTeamMember,
      disqualifyTeam,
      
      toggleSFXMute,
      refreshData
    }}>
      {children}
    </ArenaContext.Provider>
  );
};

export const useArena = () => {
  const context = useContext(ArenaContext);
  if (!context) {
    throw new Error('useArena must be used within an ArenaProvider');
  }
  return context;
};
