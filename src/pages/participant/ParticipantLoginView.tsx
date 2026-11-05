import React, { useState } from 'react';
import { useParticipant } from '../../context/ParticipantContext';
import { isSupabaseConfigured } from '../../lib/supabase';

export const ParticipantLoginView: React.FC = () => {
  const { joinTeam, isSFXMuted, toggleSFXMute } = useParticipant();
  const isRealtimeConnected = isSupabaseConfigured;

  const [teamCode, setTeamCode] = useState('');
  const [handle, setHandle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!teamCode.trim() || !handle.trim()) {
      setErrorMessage('Please enter both team code and your display name.');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await joinTeam(teamCode, handle);
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid team code or team is full.');
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Connection failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleReSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setErrorMessage(null);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased relative flex flex-col items-center justify-center p-gutter selection:bg-primary-container selection:text-on-primary">
      {/* Background Pixel & Scanline Layers */}
      <div className="fixed inset-0 pointer-events-none pixel-dot-grid opacity-10 z-0"></div>
      <div className="fixed inset-0 pointer-events-none scanline-layer opacity-20 z-0"></div>

      <main className="w-full max-w-md relative z-10 my-auto">
        <div className="flex flex-col w-full items-center justify-center p-space-xs sm:p-space-sm select-none">
          {/* Status Ribbon */}
          <div className="w-full flex items-center justify-between mb-space-sm px-space-xs text-on-surface">
            <div className="flex items-center gap-space-xs bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#000000]">
              <span className={`inline-block w-2 h-2 ${isRealtimeConnected ? 'bg-tertiary-container animate-pulse' : 'bg-outline'}`}></span>
              <span className="font-label-sm text-label-sm text-tertiary-fixed tracking-wider font-bold">
                {isRealtimeConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-space-xs bg-secondary-container text-on-secondary-container px-space-sm py-1 shadow-[2px_2px_0px_#000000]">
              <span className="material-symbols-outlined text-[14px]">sports_esports</span>
              <span className="font-label-sm text-label-sm font-bold tracking-wider">
                Contest Mode
              </span>
            </div>
          </div>

          {/* Main Card */}
          <div className="w-full bg-surface-container relative shadow-[4px_4px_0px_#000000,8px_8px_0px_#11072a] border-2 border-black">
            {/* Title Bar */}
            <div className="bg-surface-container-lowest px-space-md py-space-sm flex items-center justify-between border-b-2 border-black">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 bg-surface-container-highest flex items-center justify-center text-primary-container relative shadow-[2px_2px_0px_#000000] border border-black">
                  <span
                    className="material-symbols-outlined text-[20px] text-primary-container"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    terminal
                  </span>
                </div>
                <div>
                  <h1 className="font-headline-md text-headline-md text-primary tracking-wider uppercase font-bold">
                    Prompt Arena
                  </h1>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    Join Team
                  </p>
                </div>
              </div>
            </div>

            {/* Form Box */}
            <div className="p-space-md sm:p-space-lg flex flex-col gap-space-md bg-surface-container">
              {/* Error Banner */}
              {errorMessage && (
                <div
                  className="bg-error-container text-on-error-container p-space-sm flex items-start gap-space-sm shadow-[3px_3px_0px_#000000] border border-black"
                  id="error-banner"
                >
                  <span
                    className="material-symbols-outlined text-[20px] text-error flex-shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    error
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body-sm text-body-sm text-on-error-container leading-snug">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Input Form */}
              <form className="flex flex-col gap-space-md" onSubmit={handleLogin}>
                {/* Field 1: Team Code */}
                <div className="flex flex-col gap-1">
                  <label
                    className="font-title-sm text-title-sm text-primary uppercase flex items-center justify-between font-bold"
                    htmlFor="team-code"
                  >
                    <span>Team Code</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-normal normal-case">
                      Required
                    </span>
                  </label>
                  <div className="relative flex items-center bg-surface-container-lowest shadow-[3px_3px_0px_#000000] border border-black focus-within:border-primary-container px-space-sm">
                    <input
                      id="team-code"
                      type="text"
                      maxLength={14}
                      value={teamCode}
                      onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLogin();
                        }
                      }}
                      placeholder="e.g. ARENA-XXXX"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isLoading}
                      className="w-full bg-transparent py-space-sm font-headline-md text-headline-md text-tertiary-fixed tracking-widest uppercase focus:outline-none placeholder:text-outline-variant caret-tertiary-container font-bold font-mono disabled:opacity-50"
                    />
                  </div>
                  <span className="font-label-sm text-label-sm text-outline">
                    Ask your team captain or contest organizer
                  </span>
                </div>

                {/* Field 2: Your Name */}
                <div className="flex flex-col gap-1">
                  <label
                    className="font-title-sm text-title-sm text-primary uppercase flex items-center justify-between font-bold"
                    htmlFor="player-handle"
                  >
                    <span>Your Name</span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-normal normal-case">
                      Required
                    </span>
                  </label>
                  <div className="relative flex items-center bg-surface-container-lowest shadow-[3px_3px_0px_#000000] border border-black focus-within:border-secondary px-space-sm">
                    <input
                      id="player-handle"
                      type="text"
                      maxLength={24}
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleLogin();
                        }
                      }}
                      placeholder="e.g. Alice"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isLoading}
                      className="w-full bg-transparent py-space-sm font-body-lg text-body-lg text-on-surface focus:outline-none placeholder:text-outline-variant caret-secondary-container font-bold disabled:opacity-50"
                    />
                  </div>
                  <span className="font-label-sm text-label-sm text-outline">
                    Display name for the leaderboard
                  </span>
                </div>

                {/* Submit Button */}
                <button
                  id="btn-start"
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-tertiary-fixed text-on-tertiary-fixed py-space-md px-space-lg flex items-center justify-center gap-space-sm shadow-[4px_4px_0px_#000000] hover:bg-tertiary active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform cursor-pointer border-2 border-black disabled:opacity-50 mt-space-xs"
                >
                  <span
                    className={`material-symbols-outlined text-[20px] text-on-tertiary-fixed font-bold ${
                      isLoading ? 'animate-spin' : ''
                    }`}
                  >
                    {isLoading ? 'progress_activity' : 'arrow_forward'}
                  </span>
                  <span className="font-headline-md text-headline-md font-bold tracking-wider uppercase text-on-tertiary-fixed">
                    {isLoading ? 'Connecting...' : 'Enter Arena'}
                  </span>
                </button>
              </form>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-space-sm pt-space-xs">
                <button
                  type="button"
                  onClick={handleReSync}
                  className="w-full bg-surface-container-high text-primary hover:bg-surface-bright py-space-sm px-space-sm flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000000] border border-black active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-title-sm text-title-sm uppercase font-bold"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isSyncing ? 'animate-spin' : ''}`}>
                    sync
                  </span>
                  <span>{isSyncing ? 'Syncing...' : 'Re-sync'}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleSFXMute}
                  className={`w-full bg-surface-container-high ${
                    isSFXMuted ? 'text-outline' : 'text-secondary'
                  } hover:bg-surface-bright py-space-sm px-space-sm flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000000] border border-black active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-title-sm text-title-sm uppercase font-bold`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isSFXMuted ? 'volume_off' : 'volume_up'}
                  </span>
                  <span>{isSFXMuted ? 'Sound: Off' : 'Sound: On'}</span>
                </button>
              </div>
            </div>

            {/* Footer Strip */}
            <div className="bg-surface-container-lowest px-space-md py-space-xs flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm border-t-2 border-black">
              <div className="flex items-center gap-space-xs">
                <span className={`w-2 h-2 ${isRealtimeConnected ? 'bg-tertiary-container' : 'bg-outline'} rounded-full`}></span>
                <span className="font-mono">
                  {isRealtimeConnected ? 'Database Connected' : 'Connecting to Database...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
