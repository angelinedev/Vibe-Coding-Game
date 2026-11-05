import React, { useState, useEffect } from 'react';
import { useParticipant, ParticipantTab } from '../../context/ParticipantContext';

export const ParticipantHeader: React.FC = () => {
  const {
    team,
    member,
    currentTab,
    setCurrentTab,
    isArmed,
    contestState,
    isSFXMuted,
    toggleSFXMute,
    broadcasts,
    leaderboardEntries,
  } = useParticipant();

  const [timeLeft, setTimeLeft] = useState('00:00:00');

  useEffect(() => {
    const updateTimer = () => {
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

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [contestState.ends_at, contestState.status, contestState.paused_remaining_seconds]);

  const navItems: { id: ParticipantTab; label: string }[] = [
    { id: 'battle-arena', label: 'Battle Arena' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'api-key-config', label: 'API Key' },
    { id: 'quest-log', label: 'Waiting Room' },
  ];

  const activeBroadcast = contestState.current_broadcast || (broadcasts.length > 0 ? broadcasts[0].message : null);

  // Safe team rank derived from freeze-aware leaderboard RPC
  const myEntry = team ? leaderboardEntries.find(e => e.team_id === team.id) : null;
  const myRank = myEntry ? myEntry.rank : 0;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest border-b-4 border-black arcade-shadow">
        <div className="h-16 w-full px-gutter flex items-center justify-between gap-space-md">
          {/* Brand & Team Badge */}
          <div className="flex items-center gap-space-md flex-shrink-0">
            <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 border-2 border-black arcade-shadow-sm">
              <span className="w-2.5 h-2.5 bg-primary-container inline-block border border-black animate-pulse"></span>
              <span className="font-headline-md text-headline-md uppercase text-primary tracking-wider font-bold">
                Prompt Arena
              </span>
            </div>
            <div className="hidden xl:flex items-center gap-space-xs font-title-sm text-title-sm bg-surface-container px-space-sm py-1 text-secondary-fixed border border-black font-mono">
              <span className="text-on-surface-variant">Team:</span>
              <span className="font-bold text-white">{team?.name || 'Unassigned'}</span>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="hidden lg:flex items-center gap-space-xs bg-surface-container-low p-1 border-2 border-black">
            {navItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`font-title-sm text-title-sm px-space-md py-space-xs uppercase transition-none border cursor-pointer ${
                    isActive
                      ? 'bg-primary-container text-on-primary-fixed border-black font-bold shadow-sm'
                      : 'text-on-surface-variant hover:text-white hover:bg-surface-container border-transparent'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Match Status / Telemetry Widgets */}
          <div className="flex items-center gap-space-sm flex-shrink-0">
            <div className="hidden sm:flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 border-2 border-black text-tertiary-fixed font-title-sm text-title-sm">
              <span className={`w-2 h-2 ${isArmed ? 'bg-tertiary-fixed animate-ping' : 'bg-secondary'} inline-block`}></span>
              <span className="uppercase font-bold tracking-wider font-mono">
                {isArmed ? 'Live' : 'Standby'}
              </span>
            </div>

            {/* Countdown Clock */}
            <div className="flex items-center gap-space-xs bg-surface-container-highest px-space-md py-1 border-2 border-black text-primary-container font-headline-md text-headline-md font-bold font-mono">
              <span className="material-symbols-outlined text-[16px] text-primary-container">timer</span>
              <span>{timeLeft}</span>
            </div>

            {/* Rank / Points */}
            <div className="hidden md:flex flex-col items-end justify-center bg-surface-container-low px-space-md py-1 border-2 border-black">
              <div className="flex items-center gap-space-xs">
                <span className="text-secondary font-label-md text-label-md uppercase font-bold">Rank</span>
                <span className="text-primary-container font-headline-md text-headline-md font-bold font-mono">
                  {myRank > 0 ? `#${String(myRank).padStart(2, '0')}` : '--'}
                </span>
              </div>
              <span className="text-tertiary-fixed-dim font-label-sm text-label-sm uppercase tracking-wider font-mono">
                {team?.best_score != null ? `${team.best_score.toLocaleString()} PTS` : '0 PTS'}
              </span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={toggleSFXMute}
              className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-1 border-2 border-black text-on-surface hover:bg-secondary-container hover:text-on-secondary-container transition-none active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isSFXMuted ? 'volume_off' : 'volume_up'}
              </span>
              <span className="font-label-md text-label-md uppercase font-bold">
                {isSFXMuted ? 'Sound: Off' : 'Sound: On'}
              </span>
            </button>

            {/* Pilot Avatar */}
            <div
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center border-2 border-black flex-shrink-0"
              title={`Member: ${member?.display_name || 'Contestant'}`}
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </div>

        {/* Global Broadcast Ticker Bar */}
        {activeBroadcast && (
          <div className="w-full bg-secondary-container text-on-secondary-container px-space-md py-1 border-t-2 border-black flex items-center justify-between text-label-sm overflow-hidden shadow-inner">
            <div className="flex items-center gap-space-xs font-bold uppercase flex-shrink-0">
              <span className="material-symbols-outlined text-[14px]">campaign</span>
              <span>Announcement:</span>
            </div>
            <div className="truncate flex-1 px-space-md font-mono text-white tracking-wide">
              {activeBroadcast}
            </div>
          </div>
        )}
      </header>

      {/* Mobile Subnav for smaller screens */}
      <div className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-surface-container-low border-b-2 border-black flex items-center justify-around p-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id)}
            className={`font-label-sm text-label-sm px-2 py-1 uppercase ${
              currentTab === item.id ? 'bg-primary-container text-on-primary-fixed font-bold' : 'text-on-surface-variant'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
};
