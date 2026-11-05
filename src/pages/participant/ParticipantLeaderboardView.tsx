import React, { useState, useEffect } from 'react';
import { useParticipant, LeaderboardEntry } from '../../context/ParticipantContext';

export const ParticipantLeaderboardView: React.FC = () => {
  const { 
    team, 
    contestState, 
    leaderboardEntries, 
    contestStats, 
    onlinePodsCount, 
    refreshLeaderboard 
  } = useParticipant();

  const [isPinging, setIsPinging] = useState(false);
  const [pingSuccess, setPingSuccess] = useState(false);

  // Derive real countdown from contestState
  const [timeLeft, setTimeLeft] = useState('00:00');
  useEffect(() => {
    const updateCountdown = () => {
      if (contestState.status === 'paused') {
        if (contestState.paused_remaining_seconds != null) {
          const m = Math.floor(contestState.paused_remaining_seconds / 60);
          const s = contestState.paused_remaining_seconds % 60;
          const fmt = (n: number) => n.toString().padStart(2, '0');
          setTimeLeft(`${fmt(m)}:${fmt(s)}`);
        }
        return;
      }

      if (!contestState.ends_at || contestState.status !== 'running') {
        setTimeLeft('00:00');
        return;
      }

      const diff = new Date(contestState.ends_at).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00');
        return;
      }

      const m = Math.floor(diff / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      const fmt = (n: number) => n.toString().padStart(2, '0');
      setTimeLeft(`${fmt(m)}:${fmt(s)}`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [contestState.ends_at, contestState.status, contestState.paused_remaining_seconds]);

  const handlePingSync = async () => {
    setIsPinging(true);
    await refreshLeaderboard();
    setIsPinging(false);
    setPingSuccess(true);
    setTimeout(() => setPingSuccess(false), 1500);
  };

  // Safe entries loaded via RPC get_leaderboard()
  const goldTeam: LeaderboardEntry | null = leaderboardEntries[0] || null;
  const silverTeam: LeaderboardEntry | null = leaderboardEntries[1] || null;
  const bronzeTeam: LeaderboardEntry | null = leaderboardEntries[2] || null;

  const podiumGap = leaderboardEntries.length >= 2 
    ? (leaderboardEntries[0].best_score - leaderboardEntries[1].best_score) 
    : 0;
  const solvedCount = leaderboardEntries.filter(t => t.best_score > 0).length;

  // Find user's pod rank from safe leaderboard
  const myEntry = team ? leaderboardEntries.find(t => t.team_id === team.id) : null;
  const myRank = myEntry ? myEntry.rank : 0;

  const isFrozen = contestState.leaderboard_frozen || Boolean(leaderboardEntries[0]?.is_frozen);

  return (
    <div className="w-full flex flex-col">
      {/* BANNER NOTIFICATION: FROZEN OR ACTIVE STATE */}
      <div className="w-full bg-surface-container-lowest px-gutter py-space-sm border-b-2 border-black">
        <div className="w-full bg-surface-container-high p-space-sm shadow-xl flex flex-col md:flex-row items-center justify-between gap-space-sm relative overflow-hidden border-2 border-black arcade-shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-container/10 via-secondary/10 to-primary-container/10 pointer-events-none"></div>
          <div className="flex items-center gap-space-md z-10 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 bg-surface-container-lowest text-primary-container shadow-sm flex-shrink-0 border border-black">
              <span className={`material-symbols-outlined text-[24px] ${isFrozen ? 'animate-spin' : ''}`}>
                {isFrozen ? 'ac_unit' : 'leaderboard'}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-space-sm flex-wrap">
                <span className={`text-on-secondary-container font-label-sm text-label-sm px-space-sm py-0.5 uppercase tracking-widest font-bold border border-black ${
                  isFrozen ? 'bg-secondary-container animate-pulse' : 'bg-primary-container text-black'
                }`}>
                  {isFrozen ? 'Frozen State' : 'Live'}
                </span>
                <span className="font-headline-md text-headline-md text-primary tracking-wider uppercase truncate font-bold">
                  {isFrozen ? 'Leaderboard is Frozen' : 'Tournament Standings'}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {isFrozen
                  ? 'Public rankings are held for the final ceremony. Solves and points still count.'
                  : 'Realtime standings updated across all teams.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-sm flex-shrink-0 z-10 w-full md:w-auto justify-end">
            <div className="bg-surface-container-lowest px-space-md py-space-xs text-right border border-black">
              <span className="text-on-surface-variant font-label-sm text-label-sm block uppercase tracking-wider font-bold">
                {isFrozen ? 'Time' : 'Contest Clock'}
              </span>
              <span className="font-headline-md text-headline-md text-secondary tracking-widest font-bold font-mono">
                {timeLeft}
              </span>
            </div>
            <button
              onClick={handlePingSync}
              className="bg-primary-container text-on-primary-fixed hover:bg-tertiary-fixed font-title-sm text-title-sm px-space-md py-space-sm uppercase shadow-md active:translate-x-0.5 active:translate-y-0.5 transition-none flex items-center gap-space-xs border-2 border-black font-bold cursor-pointer"
              type="button"
            >
              <span className={`material-symbols-outlined text-[16px] ${isPinging ? 'animate-spin' : ''}`}>
                {pingSuccess ? 'done' : 'sync'}
              </span>
              <span>{isPinging ? 'Syncing...' : pingSuccess ? 'Synced' : 'Refresh Standings'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN HUD PODIUM DECK */}
      <div className="w-full px-gutter py-space-lg flex flex-col gap-space-xl">
        {/* METRICS TICKER */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
          <div className="bg-surface-container p-space-md shadow-md flex flex-col justify-between border-2 border-black arcade-shadow-sm">
            <div className="flex items-center justify-between text-on-surface-variant font-bold">
              <span className="font-label-sm text-label-sm uppercase tracking-wider">Active Teams</span>
              <span className="material-symbols-outlined text-[16px] text-primary-container">groups</span>
            </div>
            <div className="mt-space-sm flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-primary font-bold">{onlinePodsCount}</span>
              <span className="font-label-md text-label-md text-on-surface-variant font-bold">
                / {contestStats.total_teams} Teams
              </span>
            </div>
          </div>

          <div className="bg-surface-container p-space-md shadow-md flex flex-col justify-between border-2 border-black arcade-shadow-sm">
            <div className="flex items-center justify-between text-on-surface-variant font-bold">
              <span className="font-label-sm text-label-sm uppercase tracking-wider">Top Gap (#1 - #2)</span>
              <span className="material-symbols-outlined text-[16px] text-secondary">trending_up</span>
            </div>
            <div className="mt-space-sm flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-secondary font-bold font-mono">
                +{podiumGap}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant font-bold">PTS</span>
            </div>
          </div>

          <div className="bg-surface-container p-space-md shadow-md flex flex-col justify-between border-2 border-black arcade-shadow-sm">
            <div className="flex items-center justify-between text-on-surface-variant font-bold">
              <span className="font-label-sm text-label-sm uppercase tracking-wider">Teams with Solves</span>
              <span className="material-symbols-outlined text-[16px] text-tertiary-fixed">code_blocks</span>
            </div>
            <div className="mt-space-sm flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-tertiary-fixed font-bold font-mono">
                {solvedCount}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant font-bold">
                / {contestStats.total_teams}
              </span>
            </div>
          </div>

          <div className="bg-surface-container p-space-md shadow-md flex flex-col justify-between border-2 border-black arcade-shadow-sm">
            <div className="flex items-center justify-between text-on-surface-variant font-bold">
              <span className="font-label-sm text-label-sm uppercase tracking-wider">Your Rank</span>
              <span className="material-symbols-outlined text-[16px] text-primary">military_tech</span>
            </div>
            <div className="mt-space-sm flex items-baseline gap-space-xs">
              <span className="font-headline-xl text-headline-xl text-primary font-bold font-mono">
                {myRank > 0 ? `#${String(myRank).padStart(2, '0')}` : '--'}
              </span>
              <span className="font-label-md text-label-md text-on-surface-variant font-bold">
                {team?.best_score != null ? `(${team.best_score} PTS)` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* TOP 3 PODIUM DISPLAY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg items-end pt-space-lg">
          {/* SILVER #02 */}
          <div className="order-2 md:order-1 bg-surface-container p-space-lg shadow-xl relative overflow-hidden flex flex-col items-center text-center border-2 border-black arcade-shadow">
            <div className="absolute top-0 left-0 bg-surface-container-highest px-space-sm py-0.5 font-label-sm text-label-sm text-on-surface font-bold border-b border-r border-black font-mono">
              #2 Silver
            </div>
            <div className="w-16 h-16 bg-surface-container-highest rounded-none flex items-center justify-center my-space-md shadow-sm border border-black text-2xl font-bold font-mono text-outline">
              02
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface uppercase truncate max-w-full font-bold">
              {silverTeam?.name || 'Awaiting Team'}
            </h3>
            <div className="mt-space-sm bg-surface-container-lowest px-space-md py-space-xs border border-black font-mono">
              <span className="font-headline-md text-headline-md text-primary font-bold">
                {silverTeam?.best_score?.toLocaleString() || 0}
              </span>
              <span className="text-on-surface-variant text-label-sm ml-1">PTS</span>
            </div>
          </div>

          {/* GOLD #01 */}
          <div className="order-1 md:order-2 bg-surface-container-high p-space-xl shadow-2xl relative overflow-hidden flex flex-col items-center text-center border-4 border-black arcade-shadow md:-translate-y-4">
            <div className="absolute top-0 left-0 bg-primary-container px-space-md py-0.5 font-label-md text-label-md text-on-primary-fixed font-bold border-b-2 border-r-2 border-black font-mono">
              ★ Champion #1 ★
            </div>
            <div className="w-20 h-20 bg-primary-container text-on-primary-fixed rounded-none flex items-center justify-center my-space-md shadow-md border-2 border-black text-4xl font-bold font-mono">
              👑
            </div>
            <h3 className="font-headline-xl text-headline-xl text-primary-container uppercase truncate max-w-full font-bold">
              {goldTeam?.name || 'Awaiting Team'}
            </h3>
            <div className="mt-space-sm bg-surface-container-lowest px-space-lg py-space-sm border-2 border-black font-mono">
              <span className="font-headline-xl text-headline-xl text-tertiary-fixed font-bold">
                {goldTeam?.best_score?.toLocaleString() || 0}
              </span>
              <span className="text-on-surface-variant text-label-md ml-1 font-bold">PTS</span>
            </div>
          </div>

          {/* BRONZE #03 */}
          <div className="order-3 md:order-3 bg-surface-container p-space-lg shadow-xl relative overflow-hidden flex flex-col items-center text-center border-2 border-black arcade-shadow">
            <div className="absolute top-0 left-0 bg-surface-container-highest px-space-sm py-0.5 font-label-sm text-label-sm text-on-surface font-bold border-b border-r border-black font-mono">
              #3 Bronze
            </div>
            <div className="w-16 h-16 bg-surface-container-highest rounded-none flex items-center justify-center my-space-md shadow-sm border border-black text-2xl font-bold font-mono text-outline">
              03
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface uppercase truncate max-w-full font-bold">
              {bronzeTeam?.name || 'Awaiting Team'}
            </h3>
            <div className="mt-space-sm bg-surface-container-lowest px-space-md py-space-xs border border-black font-mono">
              <span className="font-headline-md text-headline-md text-primary font-bold">
                {bronzeTeam?.best_score?.toLocaleString() || 0}
              </span>
              <span className="text-on-surface-variant text-label-sm ml-1">PTS</span>
            </div>
          </div>
        </div>

        {/* FULL TOURNAMENT LEADERBOARD TABLE */}
        <div className="bg-surface-container shadow-xl flex flex-col border-2 border-black arcade-shadow">
          <div className="bg-surface-container-lowest px-space-md py-space-sm flex items-center justify-between border-b-2 border-black">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary-container text-[20px]">format_list_numbered</span>
              <h2 className="font-headline-md text-headline-md text-primary uppercase font-bold">
                Leaderboard Standings
              </h2>
            </div>
            <span className="font-mono text-label-sm text-on-surface-variant font-bold">
              Total Teams: {contestStats.total_teams}
            </span>
          </div>

          <div className="overflow-x-auto">
            {leaderboardEntries.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant font-mono text-body-md">
                No teams have joined yet. Leaderboard will update in real time.
              </div>
            ) : (
              <table className="w-full text-left font-body-md text-body-md">
                <thead>
                  <tr className="bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider border-b border-black font-bold">
                    <th className="py-space-sm px-space-md">Rank</th>
                    <th className="py-space-sm px-space-md">Team</th>
                    <th className="py-space-sm px-space-md text-right">Score</th>
                    <th className="py-space-sm px-space-md text-center">Tab Switches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/30 font-mono">
                  {leaderboardEntries.map((entry) => {
                    const isSelf = team && entry.team_id === team.id;
                    return (
                      <tr
                        key={entry.team_id}
                        className={`hover:bg-surface-container-high transition-colors ${
                          isSelf ? 'bg-primary-container/20 font-bold border-l-4 border-l-primary-container' : ''
                        }`}
                      >
                        <td className="py-space-md px-space-md">
                          <span className={`px-space-xs py-0.5 border border-black font-bold text-label-sm ${
                            entry.rank === 1 
                              ? 'bg-primary-container text-black font-bold' 
                              : entry.rank === 2 || entry.rank === 3 
                              ? 'bg-surface-container-highest text-on-surface' 
                              : 'bg-surface-container-lowest text-on-surface-variant'
                          }`}>
                            #{String(entry.rank).padStart(2, '0')}
                          </span>
                        </td>
                        <td className="py-space-md px-space-md">
                          <div className="flex items-center gap-space-sm">
                            <span className="font-bold text-on-surface">{entry.name}</span>
                            {isSelf && (
                              <span className="bg-primary-container text-black font-label-sm text-label-sm px-1 py-0.5 border border-black font-bold">
                                Your Team
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`py-space-md px-space-md text-right font-headline-md text-headline-md font-bold ${
                          isSelf ? 'text-primary-container' : 'text-on-surface'
                        }`}>
                          {entry.best_score.toLocaleString()} PTS
                        </td>
                        <td className="py-space-md px-space-md text-center">
                          <span className={`font-bold ${entry.tab_switch_count >= 3 ? 'text-error' : 'text-on-surface-variant'}`}>
                            {entry.tab_switch_count} {entry.tab_switch_count >= 3 ? '⚠ FLAGGED' : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM DOCK */}
      <div className="w-full bg-surface-container-high px-gutter py-space-sm shadow-xl sticky bottom-0 z-40 border-t-2 border-black">
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-lg flex-wrap">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-bold">
                YOUR POD POSITION:
              </span>
              <span className="bg-primary-container text-on-primary-fixed font-headline-md text-headline-md px-space-xs font-bold border border-black font-mono">
                {myRank > 0 ? `#${String(myRank).padStart(2, '0')} OF ${contestStats.total_teams} TEAMS` : 'NOT RANKED'}
              </span>
            </div>
            <div className="flex items-center gap-space-xs font-mono">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-bold">SCORE:</span>
              <span className="text-secondary font-bold">
                {team?.best_score != null ? `${team.best_score} PTS` : '0 PTS'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
