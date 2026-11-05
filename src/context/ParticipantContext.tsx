import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, INITIAL_CONTEST_STATE } from '../lib/supabase';
import { Team, TeamMember, Attempt, Question, ContestState, Broadcast } from '../types/database';
import { playSound } from '../lib/audio';

export type ParticipantTab = 'battle-arena' | 'leaderboard' | 'api-key-config' | 'quest-log';
export type EmergencyModalType = 'none' | 'modal-timeout' | 'modal-dq' | 'modal-key' | 'modal-freeze';

export interface LeaderboardEntry {
  team_id: string;
  name: string;
  best_score: number;
  best_score_at: string | null;
  tab_switch_count: number;
  rank: number;
  is_frozen: boolean;
}

export interface ContestStats {
  total_teams: number;
  total_attempts: number;
}

export interface ProbeResult {
  latency: number;
  tps: number;
  engine: string;
  ok: boolean;
  error?: string;
}

export interface EvalRunResult {
  runId: string;
  status: 'PASS' | 'FAIL' | 'NOT_CONNECTED';
  passRatio: string;
  score: number;
  latency: number;
  rawPayload: any;
  stdoutLogs: string[];
  testcases: { id: string; passed: boolean; label: string }[];
  failureReason?: string;
}

interface ParticipantContextType {
  team: Team | null;
  member: TeamMember | null;
  isAuthenticated: boolean;
  geminiApiKey: string; // Strictly IN-MEMORY state (never persisted to localStorage/sessionStorage)
  selectedModel: string;
  currentTab: ParticipantTab;
  activeModal: EmergencyModalType;
  tabSwitchCount: number;
  teamMembers: TeamMember[];
  attempts: Attempt[];
  questions: Question[];
  contestState: ContestState;
  broadcasts: Broadcast[];
  leaderboardEntries: LeaderboardEntry[];
  contestStats: ContestStats;
  onlinePodsCount: number;
  isArmed: boolean;
  isSFXMuted: boolean;
  lastProbeResult: ProbeResult | null;
  activeRunResult: EvalRunResult | null;
  historyRuns: EvalRunResult[];
  activeConsoleTab: 'tab-code' | 'tab-run' | 'tab-result';
  isEvaluating: boolean;
  
  // Actions
  joinTeam: (code: string, handle: string) => Promise<{ success: boolean; error?: string }>;
  leaveTeam: () => void;
  setGeminiApiKey: (key: string) => void;
  setSelectedModel: (model: string) => void;
  setCurrentTab: (tab: ParticipantTab) => void;
  setActiveModal: (modal: EmergencyModalType) => void;
  setActiveConsoleTab: (tab: 'tab-code' | 'tab-run' | 'tab-result') => void;
  toggleArmed: () => void;
  toggleSFXMute: () => void;
  runProbeTest: (overrideKey?: string) => Promise<ProbeResult>;
  evaluatePrompt: (question: Question, promptTemplate: string) => Promise<EvalRunResult>;
  recordTabSwitch: () => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
}

const ParticipantContext = createContext<ParticipantContextType | null>(null);

const STORAGE_KEY_TEAM = 'prompt_arena_participant_team';
const STORAGE_KEY_MEMBER = 'prompt_arena_participant_member';
const STORAGE_KEY_MODEL = 'prompt_arena_selected_model';

export const ParticipantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [team, setTeam] = useState<Team | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TEAM);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [member, setMember] = useState<TeamMember | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEMBER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // GEMINI API KEY: STRICTLY IN-MEMORY REACT STATE ONLY.
  // Never read from or written to localStorage/sessionStorage/IndexedDB.
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');

  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MODEL);
    return saved && !saved.includes('1.5') ? saved : 'gemini-2.5-flash';
  });

  const [currentTab, setCurrentTab] = useState<ParticipantTab>('battle-arena');
  const [activeModal, setActiveModal] = useState<EmergencyModalType>('none');
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(member?.tab_switch_count || 0);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [contestState, setContestState] = useState<ContestState>(INITIAL_CONTEST_STATE);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [contestStats, setContestStats] = useState<ContestStats>({ total_teams: 0, total_attempts: 0 });
  const [onlinePodsCount, setOnlinePodsCount] = useState<number>(1);
  const [isArmed, setIsArmed] = useState<boolean>(true);
  const [isSFXMuted, setIsSFXMuted] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'tab-code' | 'tab-run' | 'tab-result'>('tab-code');
  const [activeRunResult, setActiveRunResult] = useState<EvalRunResult | null>(null);
  const [historyRuns, setHistoryRuns] = useState<EvalRunResult[]>([]);
  const [lastProbeResult, setLastProbeResult] = useState<ProbeResult | null>(null);

  const setSelectedModel = (model: string) => {
    setSelectedModelState(model);
    try {
      localStorage.setItem(STORAGE_KEY_MODEL, model);
    } catch {}
  };

  const toggleSFXMute = () => {
    setIsSFXMuted(prev => !prev);
  };

  // Sync team and member session identifiers to localStorage
  useEffect(() => {
    try {
      if (team) localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(team));
      else localStorage.removeItem(STORAGE_KEY_TEAM);

      if (member) localStorage.setItem(STORAGE_KEY_MEMBER, JSON.stringify(member));
      else localStorage.removeItem(STORAGE_KEY_MEMBER);
    } catch {}
  }, [team, member]);

  // Safe fetch for leaderboard via RPC get_leaderboard() (Respects Freeze, no direct teams query)
  const refreshLeaderboard = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const [boardRes, statsRes] = await Promise.all([
        supabase.rpc('get_leaderboard'),
        supabase.rpc('get_contest_stats'),
      ]);

      if (boardRes.data) {
        setLeaderboardEntries(boardRes.data as LeaderboardEntry[]);
      }
      if (statsRes.data) {
        setContestStats(statsRes.data as ContestStats);
      }
    } catch (e) {
      console.warn('Could not refresh leaderboard via RPC:', e);
    }
  }, []);

  // Fetch Participant Team Data & Live Challenges
  const refreshParticipantData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Contest State (publicly readable under RLS)
      const { data: stateData } = await supabase.from('contest_state').select('*').single();
      if (stateData) {
        setContestState(stateData as ContestState);
      }

      // 2. Live Questions (participants can view live questions only under RLS)
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*')
        .order('order_index', { ascending: true });
      if (questionsData) {
        setQuestions(questionsData as Question[]);
      }

      // 3. Active Broadcasts
      const { data: broadcastData } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(10);
      if (broadcastData) {
        setBroadcasts(broadcastData as Broadcast[]);
      }

      // 4. Team-specific data (only permitted for member's own team)
      if (team) {
        const [teamRes, membersRes, attemptsRes] = await Promise.all([
          supabase.from('teams').select('*').eq('id', team.id).single(),
          supabase.from('team_members').select('*').eq('team_id', team.id).order('joined_at', { ascending: true }),
          supabase.from('attempts').select('*').eq('team_id', team.id).order('created_at', { ascending: false }).limit(20)
        ]);

        if (teamRes.data) {
          setTeam(prev => ({ ...prev, ...(teamRes.data as Team) }));
          if (teamRes.data.status === 'disqualified') {
            setActiveModal('modal-dq');
          }
        }
        if (membersRes.data) {
          const membersList = membersRes.data as TeamMember[];
          setTeamMembers(membersList);
          const currentM = membersList.find(m => m.user_id === member?.user_id);
          if (currentM) {
            setMember(currentM);
            setTabSwitchCount(currentM.tab_switch_count);
          }
        }
        if (attemptsRes.data) {
          const atts = attemptsRes.data as Attempt[];
          setAttempts(atts);
          if (atts.length > 0) {
            const mappedRuns: EvalRunResult[] = atts.map((att, idx) => ({
              runId: `RUN #${String(atts.length - idx).padStart(2, '0')}`,
              status: att.passed ? 'PASS' : 'FAIL',
              passRatio: att.passed ? 'PASSED' : 'FAILED',
              score: att.score,
              latency: 0,
              rawPayload: att.actual_output ? (() => { try { return JSON.parse(att.actual_output); } catch { return att.actual_output; } })() : null,
              stdoutLogs: [
                `[${att.created_at}] Submission recorded by team.`,
                `Verdict: ${att.passed ? 'PASS' : 'FAIL'} (Score: ${att.score})`
              ],
              testcases: [],
            }));
            setHistoryRuns(mappedRuns);
            if (!activeRunResult && mappedRuns[0]) {
              setActiveRunResult(mappedRuns[0]);
            }
          }
        }
      }

      // 5. Leaderboard snapshot/live
      await refreshLeaderboard();
    } catch (e) {
      console.warn('Error refreshing participant data:', e);
    }
  }, [team, member?.user_id, refreshLeaderboard, activeRunResult]);

  useEffect(() => {
    refreshParticipantData();
  }, [refreshParticipantData]);

  // Realtime Subscriptions & Presence
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Presence channel for online participants count
    const presenceChannel = supabase.channel('participant-lobby-presence');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.keys(state).length;
        setOnlinePodsCount(Math.max(1, count));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && team) {
          await presenceChannel.track({
            team_id: team.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Telemetry channel for state, broadcasts, and questions
    const telemetryChannel = supabase
      .channel('participant-telemetry-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contest_state' }, (payload) => {
        if (payload.new) {
          const nextState = payload.new as ContestState;
          setContestState(nextState);
          refreshLeaderboard();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () => {
        refreshParticipantData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcasts' }, (payload) => {
        if (payload.new) {
          playSound.broadcast();
          setBroadcasts(prev => [payload.new as Broadcast, ...prev]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(telemetryChannel);
    };
  }, [team?.id, refreshLeaderboard, refreshParticipantData]);

  // Tab switch listener (Proctor Sentinel)
  useEffect(() => {
    if (!team) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordTabSwitch();
      }
    };

    const handleBlur = () => {
      recordTabSwitch();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [team]);

  const recordTabSwitch = async () => {
    playSound.warning();
    setTabSwitchCount(prev => {
      const next = prev + 1;
      if (next >= 3) {
        setActiveModal('modal-dq');
      }
      return next;
    });

    if (isSupabaseConfigured) {
      try {
        await supabase.rpc('increment_tab_switch');
      } catch (err) {
        console.warn('Could not record tab switch via RPC:', err);
      }
    }
  };

  // Join Team function with real Supabase RPC
  const joinTeam = async (code: string, handle: string): Promise<{ success: boolean; error?: string }> => {
    playSound.click();
    const cleanCode = code.trim().toUpperCase();
    const cleanHandle = handle.trim();

    if (!cleanCode) return { success: false, error: 'Team join code is required.' };
    if (!cleanHandle) return { success: false, error: 'Contestant handle is required.' };

    if (isSupabaseConfigured) {
      try {
        const { data: authData } = await supabase.auth.getSession();
        let user = authData?.session?.user;
        if (!user) {
          const anon = await supabase.auth.signInAnonymously();
          user = anon.data?.user || undefined;
        }

        const rpcRes = await supabase.rpc('join_team', {
          code: cleanCode,
          display_name: cleanHandle,
        });

        if (rpcRes.error) {
          return { success: false, error: rpcRes.error.message };
        }

        const joined = rpcRes.data;
        if (joined && joined.success === false) {
          return { success: false, error: joined.error || 'Invalid join code.' };
        }

        if (joined?.team_id) {
          const { data: teamData } = await supabase.from('teams').select('*').eq('id', joined.team_id).single();
          if (teamData) {
            setTeam(teamData as Team);
          }

          const localMember: TeamMember = {
            id: crypto.randomUUID(),
            team_id: joined.team_id,
            user_id: user?.id || crypto.randomUUID(),
            display_name: cleanHandle,
            tab_switch_count: 0,
            joined_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          };

          setMember(localMember);
          setTabSwitchCount(0);
          playSound.start();
          return { success: true };
        }
      } catch (err: any) {
        return { success: false, error: err?.message || 'Connection failed.' };
      }
    }

    return { success: false, error: 'Supabase backend is not configured.' };
  };

  const leaveTeam = () => {
    setTeam(null);
    setMember(null);
    setTeamMembers([]);
    setAttempts([]);
    setHistoryRuns([]);
    setActiveRunResult(null);
    setGeminiApiKey(''); // Clear in-memory API key
    try {
      localStorage.removeItem(STORAGE_KEY_TEAM);
      localStorage.removeItem(STORAGE_KEY_MEMBER);
    } catch {}
  };

  const toggleArmed = () => {
    playSound.click();
    setIsArmed(prev => !prev);
  };

  // Real Gemini API Connection Probe (in-memory key test)
  const runProbeTest = async (overrideKey?: string): Promise<ProbeResult> => {
    playSound.click();
    const keyToTest = (overrideKey !== undefined ? overrideKey : geminiApiKey).trim();

    if (!keyToTest) {
      const res: ProbeResult = {
        latency: 0,
        tps: 0,
        engine: 'NO_KEY_ENTERED',
        ok: false,
        error: 'Please paste your Gemini API key from Google AI Studio.',
      };
      setLastProbeResult(res);
      return res;
    }

    const start = Date.now();
    const candidateModels = [
      selectedModel && !selectedModel.includes('1.5') ? selectedModel : 'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-flash-latest'
    ];
    let lastError = '';

    for (const model of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToTest}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Respond with OK' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        });

        const elapsed = Date.now() - start;
        if (response.ok) {
          setGeminiApiKey(keyToTest);
          setSelectedModelState(model);

          const res: ProbeResult = {
            latency: elapsed,
            tps: Math.round((1000 / (elapsed || 1)) * 5),
            engine: `${model.toUpperCase()} CONNECTED`,
            ok: true,
          };
          setLastProbeResult(res);
          return res;
        } else {
          const errJson = await response.json().catch(() => ({}));
          lastError = errJson?.error?.message || `HTTP ${response.status}`;
        }
      } catch (e: any) {
        lastError = e?.message || 'Network fetch failed';
      }
    }

    const res: ProbeResult = {
      latency: Date.now() - start,
      tps: 0,
      engine: 'CONNECTION_FAILED',
      ok: false,
      error: lastError || 'Failed to connect to Gemini API',
    };
    setLastProbeResult(res);
    return res;
  };

  // Real evaluation function
  const evaluatePrompt = async (question: Question, promptTemplate: string): Promise<EvalRunResult> => {
    setIsEvaluating(true);
    playSound.click();

    if (!geminiApiKey) {
      const notConnectedRun: EvalRunResult = {
        runId: `RUN #${String(historyRuns.length + 1).padStart(2, '0')}`,
        status: 'NOT_CONNECTED',
        passRatio: 'NOT RUN',
        score: 0,
        latency: 0,
        rawPayload: { error: 'NO_KEY_CONFIGURED', message: 'No Gemini API Key in memory.' },
        stdoutLogs: [
          `[${new Date().toISOString().slice(11, 19)}] EVALUATION ABORTED:`,
          'Gemini API Key is not configured.',
          'Please navigate to [03 API KEY / CONFIG] and enter your key from Google AI Studio.',
        ],
        testcases: [],
        failureReason: 'Missing Gemini API Key',
      };
      setActiveRunResult(notConnectedRun);
      setActiveConsoleTab('tab-run');
      setIsEvaluating(false);
      return notConnectedRun;
    }

    const startTime = Date.now();
    let emittedCode = '';
    let parsedResult: any = null;
    let isSuccess = false;
    let evalError: string | undefined = undefined;
    let activeModelName = selectedModel && !selectedModel.includes('1.5') ? selectedModel : 'gemini-2.5-flash';

    const candidateModels = [activeModelName, 'gemini-2.5-flash-lite', 'gemini-flash-latest'];

    for (const model of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const finalPrompt = `${promptTemplate}\n\nTask Input: ${question.input_data}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (response.ok) {
          activeModelName = model;
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          emittedCode = text;

          try {
            const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedResult = JSON.parse(cleaned);
          } catch {
            parsedResult = { rawText: text };
          }

          if (question.expected_output && question.expected_output.trim()) {
            const expectedClean = question.expected_output.trim();
            const actualClean = (typeof parsedResult === 'string' ? parsedResult : JSON.stringify(parsedResult)).trim();
            isSuccess = actualClean === expectedClean || text.trim() === expectedClean;
          } else {
            isSuccess = true;
          }
          evalError = undefined;
          break; // successfully evaluated
        } else {
          const errData = await response.json().catch(() => ({}));
          evalError = errData?.error?.message || `HTTP ${response.status}`;
          parsedResult = { error: evalError };
        }
      } catch (err: any) {
        evalError = err?.message || 'Failed to dispatch request to Gemini API.';
        parsedResult = { error: evalError };
      }
    }

    const elapsed = Date.now() - startTime;
    const runId = `RUN #${String(historyRuns.length + 1).padStart(2, '0')}`;
    const calculatedScore = isSuccess ? question.max_points : 0;

    const newRun: EvalRunResult = {
      runId,
      status: isSuccess ? 'PASS' : 'FAIL',
      passRatio: isSuccess ? 'PASSED' : 'FAILED',
      score: calculatedScore,
      latency: elapsed,
      rawPayload: parsedResult,
      stdoutLogs: [
        `[${new Date().toISOString().slice(11, 19)}] LLM INFERENCE COMPLETED (${elapsed}ms)`,
        `Target Model: ${selectedModel.toUpperCase()}`,
        `Payload Tokens: ${emittedCode.length} characters emitted`,
        evalError ? `[ERROR]: ${evalError}` : `Verdict: ${isSuccess ? 'PASS' : 'FAIL'} (Awarded: ${calculatedScore} PTS)`
      ],
      testcases: [
        { id: 'TESTCASE-01', passed: isSuccess, label: isSuccess ? 'PASS' : 'FAIL' }
      ],
      failureReason: isSuccess ? undefined : evalError || 'Output did not match expected specification.',
    };

    setActiveRunResult(newRun);
    setHistoryRuns(prev => [newRun, ...prev]);
    setActiveConsoleTab('tab-result');
    setIsEvaluating(false);

    // Record attempt to Supabase
    if (isSupabaseConfigured && team) {
      try {
        await supabase.from('attempts').insert({
          team_id: team.id,
          user_id: member?.user_id || null,
          question_id: question.id,
          prompt: promptTemplate,
          generated_code: emittedCode,
          actual_output: null,
          passed: false,
          score: 0,
        });
      } catch (e) {
        console.warn('Could not record attempt to Supabase:', e);
      }
    }

    return newRun;
  };

  return (
    <ParticipantContext.Provider
      value={{
        team,
        member,
        isAuthenticated: Boolean(team && member),
        geminiApiKey,
        selectedModel,
        currentTab,
        activeModal,
        tabSwitchCount,
        teamMembers,
        attempts,
        questions,
        contestState,
        broadcasts,
        leaderboardEntries,
        contestStats,
        onlinePodsCount,
        isArmed,
        isSFXMuted,
        lastProbeResult,
        activeRunResult,
        historyRuns,
        activeConsoleTab,
        isEvaluating,

        joinTeam,
        leaveTeam,
        setGeminiApiKey,
        setSelectedModel,
        setCurrentTab,
        setActiveModal,
        setActiveConsoleTab,
        toggleArmed,
        toggleSFXMute,
        runProbeTest,
        evaluatePrompt,
        recordTabSwitch,
        refreshLeaderboard,
      }}
    >
      {children}
    </ParticipantContext.Provider>
  );
};

export const useParticipant = () => {
  const context = useContext(ParticipantContext);
  if (!context) {
    throw new Error('useParticipant must be used within a ParticipantProvider');
  }
  return context;
};
