import React, { useState, useEffect, useMemo } from 'react';
import { useParticipant } from '../../context/ParticipantContext';
import { Question } from '../../types/database';
import { parseQuestionTestCases } from '../../lib/testcases';

export const ParticipantArenaView: React.FC = () => {
  const {
    team,
    tabSwitchCount,
    activeConsoleTab,
    setActiveConsoleTab,
    activeRunResult,
    historyRuns,
    isEvaluating,
    evaluatePrompt,
    selectedModel,
    recordTabSwitch,
    questions,
    contestState,
  } = useParticipant();

  // Active question selection from real questions in Supabase
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const liveQuestions = questions.filter(q => q.status === 'live');
  const availableQuestions = liveQuestions;
  const activeQuestion: Question | undefined = availableQuestions[selectedQuestionIndex];

  const parsedTestCases = useMemo(() => {
    if (!activeQuestion) return [];
    return parseQuestionTestCases(activeQuestion.input_data, activeQuestion.expected_output);
  }, [activeQuestion]);

  // Prompt text
  const [promptCode, setPromptCode] = useState<string>(
`// Write your prompt here:
Instruction: Generate a JavaScript function that processes the input data and returns the expected result.
Input: {{query}}`
  );

  const [promptMode, setPromptMode] = useState<'hybrid' | 'json' | 'strict'>('hybrid');

  // Countdown timer derived directly from real contestState
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  useEffect(() => {
    const updateCountdown = () => {
      if (contestState.status === 'paused') {
        if (contestState.paused_remaining_seconds != null) {
          const h = Math.floor(contestState.paused_remaining_seconds / 3600);
          const m = Math.floor((contestState.paused_remaining_seconds % 3600) / 60);
          const s = contestState.paused_remaining_seconds % 60;
          const fmt = (n: number) => n.toString().padStart(2, '0');
          setTimeLeft(`${fmt(h)}:${fmt(m)}:${fmt(s)}`);
        }
        return;
      }

      if (!contestState.ends_at || contestState.status !== 'running') {
        setTimeLeft('00:00:00');
        return;
      }

      const diff = new Date(contestState.ends_at).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      const fmt = (n: number) => n.toString().padStart(2, '0');
      setTimeLeft(`${fmt(h)}:${fmt(m)}:${fmt(s)}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [contestState.ends_at, contestState.status, contestState.paused_remaining_seconds]);

  // Handle Ctrl+Enter to trigger evaluate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunEval();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeQuestion, promptCode]);

  const handleRunEval = async () => {
    if (isEvaluating || !activeQuestion) return;
    await evaluatePrompt(activeQuestion, promptCode);
  };

  const lines = promptCode.split('\n');

  return (
    <div className="w-full flex flex-col">
      {/* TOURNAMENT SUB-HUD / POD TELEMETRY BAR */}
      <div className="w-full px-gutter py-space-sm bg-surface-container-lowest shadow-md flex flex-wrap items-center justify-between gap-space-sm border-b-2 border-black">
        <div className="flex flex-wrap items-center gap-space-md">
          <div className="flex items-center gap-space-xs bg-surface-container-high px-space-md py-space-xs shadow-sm border border-black">
            <span className="w-2.5 h-2.5 bg-primary-container inline-block"></span>
            <span className="font-headline-md text-headline-md text-primary tracking-wide font-bold">
              Team: {team?.name || 'Unassigned'}
            </span>
          </div>
          <div className="flex items-center gap-space-xs bg-surface-container px-space-sm py-space-xs shadow-sm border border-black font-bold">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase">Time Left:</span>
            <span className={`font-headline-md text-headline-md text-primary-container tracking-wider font-mono ${contestState.status === 'running' ? 'animate-pulse' : ''}`}>
              {timeLeft}
            </span>
          </div>
          <div className="flex items-center gap-space-xs bg-surface-container px-space-sm py-space-xs shadow-sm border border-black">
            <span className="material-symbols-outlined text-[16px] text-tertiary-fixed font-bold">stars</span>
            <span className="font-title-sm text-title-sm text-tertiary-fixed font-bold tracking-tight">
              {team?.best_score != null ? `${team.best_score.toLocaleString()} PTS` : '0 PTS'}
            </span>
          </div>
        </div>

        {/* TAB-SWITCH INTEGRITY SENTINEL */}
        <div className="flex items-center gap-space-sm bg-error-container/30 px-space-md py-space-xs shadow-sm border border-error">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[18px] text-error font-bold">warning</span>
            <span className="font-title-sm text-title-sm text-error uppercase font-bold">
              Tab switches: {tabSwitchCount} / 3 {tabSwitchCount >= 3 ? '(Risk of DQ)' : ''}
            </span>
          </div>
          <span className="hidden md:inline font-label-sm text-label-sm text-error uppercase tracking-wider bg-surface-container-lowest px-space-xs py-0.5 border border-error/50 font-bold">
            {tabSwitchCount >= 3 ? 'Flagged for proctor review' : `${Math.max(0, 3 - tabSwitchCount)} remaining before lockout`}
          </span>
        </div>
      </div>

      {/* EMPTY QUESTIONS STATE: CONTEST NOT RUNNING */}
      {liveQuestions.length === 0 && contestState.status !== 'running' && (
        <div className="w-full px-gutter py-space-xl flex flex-col items-center justify-center">
          <div className="max-w-xl w-full bg-surface-container p-space-xl border-2 border-black arcade-shadow text-center flex flex-col items-center gap-space-md font-mono">
            <div className="w-16 h-16 bg-surface-container-highest border-2 border-black flex items-center justify-center text-secondary shadow-[2px_2px_0px_#000000]">
              <span className="material-symbols-outlined text-[36px]">lock_clock</span>
            </div>
            <div className="flex flex-col gap-space-xs">
              <span className="font-headline-lg text-headline-lg uppercase font-bold text-primary tracking-wide">
                Questions Locked
              </span>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Waiting for contest organizer to unlock questions.
              </p>
            </div>
            <div className="bg-surface-container-lowest px-space-md py-space-xs border border-black text-outline font-label-sm uppercase tracking-wider font-bold">
              Questions will automatically unlock when the match starts
            </div>
          </div>
        </div>
      )}

      {/* EMPTY QUESTIONS STATE: CONTEST RUNNING (SYNCING) */}
      {liveQuestions.length === 0 && contestState.status === 'running' && (
        <div className="w-full px-gutter py-space-xl flex flex-col items-center justify-center">
          <div className="max-w-xl w-full bg-surface-container p-space-xl border-2 border-black arcade-shadow text-center flex flex-col items-center gap-space-md font-mono">
            <div className="w-16 h-16 bg-surface-container-highest border-2 border-black flex items-center justify-center text-primary-container shadow-[2px_2px_0px_#000000]">
              <span className="material-symbols-outlined text-[36px] animate-spin text-primary-container">
                progress_activity
              </span>
            </div>
            <div className="flex flex-col gap-space-xs">
              <span className="font-headline-lg text-headline-lg uppercase font-bold text-primary-container tracking-wide">
                Loading Questions...
              </span>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Fetching latest challenge targets...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION SELECTOR STRIP */}
      {liveQuestions.length > 0 && (
        <div className="w-full px-gutter pt-space-sm flex items-center gap-2 overflow-x-auto bg-surface-container-low py-2 border-b border-black">
          <span className="font-label-sm text-label-sm text-on-surface-variant font-bold uppercase pl-1">
            Questions:
          </span>
          {availableQuestions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setSelectedQuestionIndex(idx)}
              className={`px-3 py-1 font-title-sm text-title-sm uppercase font-bold border cursor-pointer ${
                selectedQuestionIndex === idx
                  ? 'bg-primary-container text-on-primary-fixed border-black'
                  : 'bg-surface-container text-on-surface-variant hover:text-white border-black/40'
              }`}
            >
              Q{idx + 1}: {q.title.slice(0, 25)}
            </button>
          ))}
        </div>
      )}

      {/* MAIN 2-COLUMN ARENA IDE WORKSPACE */}
      {liveQuestions.length > 0 && (
        <div className="w-full px-gutter py-space-md grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* ==================== LEFT COLUMN: QUEST SPEC ==================== */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          <div className="bg-surface-container shadow-md flex flex-col border-2 border-black arcade-shadow">
            <div className="h-9 bg-surface-container-lowest px-space-md flex items-center justify-between shadow-sm border-b-2 border-black">
              <div className="flex items-center gap-space-xs">
                <span className="w-2.5 h-2.5 bg-secondary inline-block"></span>
                <span className="font-label-md text-label-md text-secondary uppercase tracking-wider font-bold">
                  Challenge Details
                </span>
              </div>
            </div>

            <div className="p-space-md flex flex-col gap-space-md">
              {!activeQuestion ? (
                <div className="p-space-lg text-center text-on-surface-variant font-body-sm">
                  No active challenge available yet.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-space-xs">
                    <span className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
                      {activeQuestion.title}
                    </span>
                    <div className="flex flex-wrap items-center gap-space-xs pt-space-xs">
                      <span className="bg-secondary-container text-on-secondary-container font-label-sm text-label-sm px-space-xs py-0.5 shadow-sm uppercase font-bold border border-black">
                        {activeQuestion.tier || 'Standard'} • {activeQuestion.max_points} Pts
                      </span>
                      <span className="bg-surface-container-lowest text-outline font-label-sm text-label-sm px-space-xs py-0.5 uppercase border border-black font-bold">
                        Category: {activeQuestion.category || 'General'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-surface-container-lowest p-space-sm shadow-sm border border-black">
                    <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                      {activeQuestion.description}
                    </p>
                  </div>

                  {/* Public Sample Test Cases Showcase */}
                  <div className="flex flex-col gap-space-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-label-md text-label-md text-on-surface-variant uppercase font-bold">
                        Sample Test Cases ({parsedTestCases.filter(t => t.is_public).length})
                      </span>
                      {parsedTestCases.some(t => !t.is_public) && (
                        <span className="text-[10px] font-mono text-tertiary-fixed bg-surface-container-high px-2 py-0.5 border border-black">
                          🔒 +{parsedTestCases.filter(t => !t.is_public).length} Hidden Test Cases
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                      {/* ONLY RENDER PUBLIC SAMPLE CASES IN THE QUESTION DESCRIPTION */}
                      {parsedTestCases
                        .filter(tc => tc.is_public)
                        .map((tc, idx) => (
                          <div
                            key={tc.id || idx}
                            className="bg-surface-container-lowest p-space-sm border border-black flex flex-col gap-1.5 shadow-sm"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-title-sm text-title-sm font-bold text-primary-container">
                                Sample Case #{idx + 1}
                              </span>
                              <span className="px-1.5 py-0.2 font-label-sm text-[9px] uppercase border font-bold bg-secondary text-black border-black">
                                Sample Case
                              </span>
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-on-surface-variant font-mono uppercase">Input:</span>
                              <pre className="p-1.5 bg-surface-container-low text-tertiary-fixed font-mono text-[12px] overflow-x-auto whitespace-pre-wrap select-all">
                                <code>{tc.input || '(empty)'}</code>
                              </pre>
                            </div>

                            {tc.expected_output && (
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-secondary font-mono uppercase">Expected Output:</span>
                                <pre className="p-1.5 bg-surface-container-low text-secondary font-mono text-[12px] overflow-x-auto whitespace-pre-wrap select-all">
                                  <code>{tc.expected_output}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        ))}

                      {/* Discreet Notice for Hidden Cases */}
                      {parsedTestCases.some(t => !t.is_public) && (
                        <div className="p-2 bg-surface-container-low border border-black/50 text-[11px] font-mono text-on-surface-variant flex items-center gap-2">
                          <span className="text-tertiary-fixed">🔒</span>
                          <span>
                            {parsedTestCases.filter(t => !t.is_public).length} hidden test case(s) will be evaluated when you run your prompt.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-sm shadow-sm border border-black">
                    <span className="font-label-md text-label-md text-primary font-bold uppercase tracking-wider">
                      Evaluation Rules
                    </span>
                    <ul className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant pt-space-xs">
                      <li className="flex items-start gap-space-xs">
                        <span className="w-1.5 h-1.5 bg-primary-container mt-1.5 flex-shrink-0 inline-block"></span>
                        <span>Prompt is processed directly by Google Gemini API in your browser.</span>
                      </li>
                      <li className="flex items-start gap-space-xs">
                        <span className="w-1.5 h-1.5 bg-secondary mt-1.5 flex-shrink-0 inline-block"></span>
                        <span>Output is verified against the challenge test cases.</span>
                      </li>
                      <li className="flex items-start gap-space-xs">
                        <span className="w-1.5 h-1.5 bg-tertiary-fixed mt-1.5 flex-shrink-0 inline-block"></span>
                        <span>Awarded max score: {activeQuestion.max_points} PTS upon pass.</span>
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ==================== RIGHT COLUMN: PROMPT CRAFTER ==================== */}
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          <div className="bg-surface-container shadow-md flex flex-col border-2 border-black arcade-shadow">
            <div className="h-10 bg-surface-container-lowest px-space-md flex flex-wrap items-center justify-between gap-space-xs shadow-sm border-b-2 border-black">
              <div className="flex items-center gap-space-sm">
                <span className="w-2.5 h-2.5 bg-primary-container inline-block"></span>
                <span className="font-headline-md text-headline-md text-primary tracking-wide uppercase font-bold">
                  Prompt Crafter
                </span>
                <span className="hidden sm:inline bg-surface-container-high px-space-xs py-0.5 text-primary-container font-label-sm text-label-sm uppercase font-bold border border-black/40">
                  {selectedModel.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-low px-space-md py-space-xs flex flex-wrap items-center justify-between gap-space-sm shadow-sm border-b border-black">
              <div className="flex items-center gap-space-sm">
                <span className="font-label-sm text-label-sm text-outline uppercase font-bold">Mode:</span>
                <button
                  onClick={() => setPromptMode('hybrid')}
                  className={`font-label-sm text-label-sm px-space-xs py-0.5 font-bold uppercase shadow-sm cursor-pointer ${
                    promptMode === 'hybrid' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  Standard
                </button>
                <button
                  onClick={() => setPromptMode('json')}
                  className={`font-label-sm text-label-sm px-space-xs py-0.5 font-bold uppercase shadow-sm cursor-pointer ${
                    promptMode === 'json' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-primary'
                  }`}
                >
                  Strict JSON
                </button>
              </div>
            </div>

            {/* Code / Prompt Editor Canvas */}
            <div className="p-space-md flex flex-col gap-space-sm">
              <div className="bg-surface-container-lowest shadow-md flex font-body-sm text-body-sm min-h-[260px] overflow-hidden border-2 border-black">
                <div className="bg-surface-container-low select-none px-space-xs py-space-sm flex flex-col items-end text-outline-variant font-title-sm text-title-sm font-bold w-10 flex-shrink-0 shadow-sm leading-6 border-r border-black font-mono">
                  {lines.map((_, i) => (
                    <span key={i}>{String(i + 1).padStart(2, '0')}</span>
                  ))}
                </div>

                <div className="flex-1 p-space-sm flex flex-col font-body-sm text-body-sm overflow-x-auto leading-6 relative">
                  <textarea
                    value={promptCode}
                    onChange={(e) => setPromptCode(e.target.value)}
                    spellCheck={false}
                    className="w-full h-full min-h-[240px] bg-transparent text-on-surface font-body-sm text-body-sm leading-6 focus:outline-none resize-none font-mono caret-tertiary-fixed selection:bg-primary-container selection:text-black"
                  />
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-space-sm pt-space-xs">
                <button
                  id="btn-run-eval"
                  type="button"
                  disabled={isEvaluating || !activeQuestion}
                  onClick={handleRunEval}
                  className="w-full sm:flex-1 bg-secondary-container hover:bg-tertiary-fixed text-on-secondary-container hover:text-on-tertiary font-title-sm text-title-sm uppercase font-bold py-space-md px-space-lg shadow-xl active:translate-x-1 active:translate-y-1 transition-none flex items-center justify-center gap-space-sm border-2 border-black arcade-shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-[20px] ${isEvaluating ? 'animate-spin' : ''}`}>
                    {isEvaluating ? 'refresh' : 'play_arrow'}
                  </span>
                  <span>
                    {isEvaluating ? 'Evaluating...' : 'Run Prompt (Ctrl+Enter)'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* TABBED OUTPUT CONSOLE */}
          <div className="bg-surface-container shadow-md flex flex-col border-2 border-black arcade-shadow">
            <div className="h-10 bg-surface-container-lowest px-space-sm flex items-center justify-between shadow-sm overflow-x-auto border-b-2 border-black">
              <div className="flex items-center gap-space-xs flex-shrink-0" id="console-tabs">
                <button
                  id="tab-btn-code"
                  type="button"
                  onClick={() => setActiveConsoleTab('tab-code')}
                  className={`font-title-sm text-title-sm px-space-md py-space-xs uppercase font-bold shadow-sm border border-black cursor-pointer ${
                    activeConsoleTab === 'tab-code'
                      ? 'bg-primary-container text-on-primary'
                      : 'text-on-surface-variant hover:text-primary bg-surface-container'
                  }`}
                >
                  Output
                </button>
                <button
                  id="tab-btn-run"
                  type="button"
                  onClick={() => setActiveConsoleTab('tab-run')}
                  className={`font-title-sm text-title-sm px-space-md py-space-xs uppercase font-bold shadow-sm border border-black cursor-pointer ${
                    activeConsoleTab === 'tab-run'
                      ? 'bg-primary-container text-on-primary'
                      : 'text-on-surface-variant hover:text-primary bg-surface-container'
                  }`}
                >
                  Run Logs
                </button>
                <button
                  id="tab-btn-result"
                  type="button"
                  onClick={() => setActiveConsoleTab('tab-result')}
                  className={`font-title-sm text-title-sm px-space-md py-space-xs uppercase font-bold shadow-sm border border-black cursor-pointer ${
                    activeConsoleTab === 'tab-result'
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : 'text-tertiary-fixed hover:text-primary bg-surface-container'
                  }`}
                >
                  Test Result
                </button>
              </div>
            </div>

            {/* Console Content */}
            <div className="p-space-md flex flex-col gap-space-sm">
              {!activeRunResult ? (
                <div className="bg-surface-container-lowest p-space-lg text-center text-on-surface-variant font-body-sm border border-black">
                  No evaluation run yet. Click 'Run Prompt' to execute.
                </div>
              ) : activeRunResult.status === 'NOT_CONNECTED' ? (
                <div className="bg-error-container/30 border-2 border-error p-space-md text-error flex flex-col gap-2">
                  <span className="font-title-sm text-title-sm uppercase font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">vpn_key_alert</span>
                    No Gemini API Key Configured
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">
                    Please open the API Key tab and enter your Google AI Studio key to test prompts.
                  </p>
                </div>
              ) : activeConsoleTab === 'tab-code' ? (
                <div className="bg-surface-container-lowest p-space-md shadow-sm overflow-x-auto border border-black">
                  <pre className="font-body-md text-body-md leading-6 text-on-surface font-mono">
                    <code>
                      {typeof activeRunResult.rawPayload === 'string'
                        ? activeRunResult.rawPayload
                        : JSON.stringify(activeRunResult.rawPayload, null, 2)}
                    </code>
                  </pre>
                </div>
              ) : activeConsoleTab === 'tab-run' ? (
                <div className="bg-surface-container-lowest p-space-md shadow-sm font-body-sm text-body-sm leading-6 flex flex-col gap-1 font-mono border border-black">
                  {activeRunResult.stdoutLogs.map((log, idx) => (
                    <div key={idx} className="text-on-surface">
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Summary Verdict Banner */}
                  <div className={`p-space-md border-2 border-black flex flex-col sm:flex-row items-center justify-between gap-space-sm shadow-md ${
                    activeRunResult.status === 'PASS'
                      ? 'bg-tertiary-container/30 border-tertiary-fixed text-tertiary-fixed'
                      : activeRunResult.score > 0
                      ? 'bg-secondary-container/30 border-secondary text-secondary'
                      : 'bg-error-container/30 border-error text-error'
                  }`}>
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-[32px]">
                        {activeRunResult.status === 'PASS' ? 'verified' : activeRunResult.score > 0 ? 'published_with_changes' : 'cancel'}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-headline-md text-headline-md font-bold uppercase">
                          {activeRunResult.status === 'PASS'
                            ? 'All Tests Passed'
                            : activeRunResult.score > 0
                            ? 'Partial Pass'
                            : 'Evaluation Failed'}
                        </span>
                        <span className="text-[12px] font-mono text-on-surface">
                          {activeRunResult.passRatio} • Latency: {activeRunResult.latency}ms
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-space-md py-1 font-title-sm text-title-sm font-bold uppercase border border-black shadow-sm ${
                        activeRunResult.status === 'PASS'
                          ? 'bg-tertiary-fixed text-black'
                          : activeRunResult.score > 0
                          ? 'bg-secondary text-black'
                          : 'bg-error-container text-white'
                      }`}>
                        +{activeRunResult.score} PTS
                      </span>
                    </div>
                  </div>

                  {/* Individual Test Case Breakdown Cards */}
                  {activeRunResult.testcases && activeRunResult.testcases.length > 0 && (
                    <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                      {activeRunResult.testcases.map((tc, idx) => (
                        <div
                          key={tc.id || idx}
                          className={`p-space-sm border-2 border-black flex flex-col gap-2 shadow-sm ${
                            tc.passed
                              ? 'bg-surface-container-lowest border-l-4 border-l-tertiary-fixed'
                              : 'bg-surface-container-lowest border-l-4 border-l-error'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`material-symbols-outlined text-[18px] ${
                                tc.passed ? 'text-tertiary-fixed' : 'text-error'
                              }`}>
                                {tc.passed ? 'check_circle' : 'cancel'}
                              </span>
                              <span className="font-title-sm text-title-sm font-bold text-on-surface">
                                #{idx + 1} {tc.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 font-label-sm text-[8px] uppercase border font-bold ${
                                tc.is_public
                                  ? 'bg-secondary text-black border-black'
                                  : 'bg-surface-container-high text-outline border-black'
                              }`}>
                                {tc.is_public ? 'Public Sample' : '🔒 Hidden Test'}
                              </span>
                              <span className={`px-2 py-0.5 font-label-sm text-[9px] uppercase font-bold border border-black ${
                                tc.passed
                                  ? 'bg-tertiary-fixed text-black'
                                  : 'bg-error text-white'
                              }`}>
                                {tc.passed ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                          </div>

                          {/* For Public Cases: Show Full Input & Output */}
                          {tc.is_public ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px] font-mono">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-on-surface-variant uppercase">Input:</span>
                                <pre className="p-1 bg-surface-container-low text-tertiary-fixed overflow-x-auto whitespace-pre-wrap">
                                  <code>{tc.input || '(empty)'}</code>
                                </pre>
                              </div>

                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-on-surface-variant uppercase">Your Output:</span>
                                <pre className={`p-1 bg-surface-container-low overflow-x-auto whitespace-pre-wrap ${
                                  tc.passed ? 'text-tertiary-fixed' : 'text-error'
                                }`}>
                                  <code>{tc.actual_output || '(no output)'}</code>
                                </pre>
                              </div>
                            </div>
                          ) : (
                            /* For Hidden Cases: Input & Output are strictly masked */
                            <div className="p-2 bg-surface-container-low border border-black/40 text-[11px] font-mono flex items-center justify-between">
                              <span className="text-on-surface-variant flex items-center gap-1.5">
                                <span>🔒</span>
                                <span>Input &amp; Output Hidden</span>
                              </span>
                              <span className={tc.passed ? 'text-tertiary-fixed font-bold' : 'text-error font-bold'}>
                                {tc.passed ? '✓ Passed evaluation' : '✗ Failed evaluation'}
                              </span>
                            </div>
                          )}

                          {tc.is_public && tc.expected_output && !tc.passed && (
                            <div className="flex flex-col gap-0.5 text-[12px] font-mono border-t border-black/20 pt-1">
                              <span className="text-[10px] text-secondary uppercase">Expected Output (Sample):</span>
                              <pre className="p-1 bg-surface-container-low text-secondary overflow-x-auto whitespace-pre-wrap">
                                <code>{tc.expected_output}</code>
                              </pre>
                            </div>
                          )}

                          {!tc.is_public && !tc.passed && (
                            <div className="text-[10px] text-outline italic font-mono pt-0.5">
                              Hidden test case failed. Check edge cases, boundary conditions, empty values, or data formatting.
                            </div>
                          )}

                          {tc.error && (
                            <div className="text-[11px] text-error font-mono">
                              Error: {tc.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {activeRunResult.failureReason && (
                    <p className="font-body-sm text-body-sm text-error font-mono">
                      {activeRunResult.failureReason}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* ATTEMPT HISTORY TABLE */}
      <div className="w-full px-gutter pb-space-xl">
        <div className="bg-surface-container shadow-md flex flex-col border-2 border-black arcade-shadow">
          <div className="h-10 bg-surface-container-lowest px-space-md flex flex-wrap items-center justify-between gap-space-xs shadow-sm border-b-2 border-black">
            <div className="flex items-center gap-space-sm">
              <span className="w-2.5 h-2.5 bg-secondary-fixed inline-block"></span>
              <span className="font-headline-md text-headline-md text-primary tracking-wide uppercase font-bold">
                Attempt History ({historyRuns.length})
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {historyRuns.length === 0 ? (
              <div className="p-space-lg text-center text-on-surface-variant font-body-sm">
                No submission attempts recorded for this pod yet.
              </div>
            ) : (
              <table className="w-full text-left font-body-sm text-body-sm">
                <thead>
                  <tr className="bg-surface-container-lowest text-on-surface-variant font-label-md text-label-md uppercase shadow-sm border-b border-black">
                    <th className="py-space-sm px-space-md">RUN ID</th>
                    <th className="py-space-sm px-space-md">STATUS</th>
                    <th className="py-space-sm px-space-md">SCORE</th>
                    <th className="py-space-sm px-space-md">LATENCY</th>
                    <th className="py-space-sm px-space-md">DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-y-0">
                  {historyRuns.map((run, idx) => (
                    <tr key={idx} className="border-b border-black/30 hover:bg-surface-container-high">
                      <td className="py-space-sm px-space-md font-title-sm text-title-sm text-primary-container font-bold font-mono">
                        {run.runId}
                      </td>
                      <td className="py-space-sm px-space-md">
                        <span className={`font-label-sm text-label-sm px-space-xs py-0.5 font-bold shadow-sm uppercase border border-black ${
                          run.status === 'PASS' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-error-container text-on-error-container'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="py-space-sm px-space-md font-bold font-title-sm text-title-sm text-on-surface">
                        {run.score} PTS
                      </td>
                      <td className="py-space-sm px-space-md text-on-surface-variant font-mono">
                        {run.latency > 0 ? `${run.latency}ms` : '--'}
                      </td>
                      <td className="py-space-sm px-space-md text-on-surface-variant">
                        {run.failureReason || 'Evaluation completed.'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
