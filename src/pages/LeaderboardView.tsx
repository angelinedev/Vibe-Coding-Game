import React, { useState, useMemo } from 'react';
import { useArena } from '../context/ArenaContext';
import { playSound } from '../lib/audio';

export const LeaderboardView: React.FC = () => {
  const { teams, contestState, toggleLeaderboardFreeze } = useArena();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Active teams sorted by score descending, then best_score_at ascending
  const activeLeaderboard = useMemo(() => {
    return [...teams]
      .filter(t => t.status !== 'disqualified')
      .sort((a, b) => {
        if (b.best_score !== a.best_score) {
          return b.best_score - a.best_score;
        }
        if (a.best_score_at && b.best_score_at) {
          return new Date(a.best_score_at).getTime() - new Date(b.best_score_at).getTime();
        }
        return 0;
      });
  }, [teams]);

  // Top 3 Podium contenders (real teams only)
  const first = activeLeaderboard[0] || null;
  const second = activeLeaderboard[1] || null;
  const third = activeLeaderboard[2] || null;

  // Filtered leaderboard table (slots #04+)
  const matrixTeams = useMemo(() => {
    let result = activeLeaderboard.slice(3); // Start from slot #04

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => 
        t.name.toLowerCase().includes(q) ||
        t.join_code.toLowerCase().includes(q) ||
        t.members?.some(m => m.display_name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [activeLeaderboard, searchQuery]);

  const totalPages = Math.ceil(matrixTeams.length / pageSize) || 1;
  const paginatedMatrix = matrixTeams.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = () => {
    playSound.click();
    const headers = ['Rank', 'Team Name', 'Join Code', 'Total PTS', 'Tab Switches', 'Members'];
    const rows = activeLeaderboard.map((t, idx) => [
      idx + 1,
      `"${t.name}"`,
      `"${t.join_code}"`,
      t.best_score,
      t.tab_switch_count,
      t.members?.length || 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leaderboard_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full p-gutter gap-space-lg text-on-surface">
      {/* TOP TOURNAMENT BANNER & ACTIONS */}
      <section className="bg-surface-container-lowest border-[4px] border-black shadow-[6px_6px_0px_#000000] p-space-md flex flex-col xl:flex-row xl:items-center justify-between gap-space-md relative overflow-hidden">
        <div className="flex flex-col gap-space-xs z-10">
          <div className="flex items-center gap-space-sm flex-wrap">
            <span className="w-3 h-3 bg-secondary-container blink-fast border-[2px] border-black inline-block"></span>
            <h1 className="font-['Press_Start_2P'] text-[18px] text-primary-container tracking-wider drop-shadow-[2px_2px_0px_#000000] uppercase">
              Tournament Leaderboard
            </h1>
            <span className="px-space-xs py-0.5 bg-secondary-container border-[2px] border-black text-on-secondary-container font-['Space_Mono'] text-[10px] uppercase tracking-widest shadow-[2px_2px_0px_#000000]">
              Live Telemetry
            </span>
          </div>

          <div className="flex items-center gap-space-md text-on-surface-variant font-['VT323'] text-[18px] flex-wrap">
            <span className="flex items-center gap-1.5 text-tertiary-fixed font-bold">
              <span className="w-2 h-2 bg-tertiary-fixed inline-block"></span>
              Scoring: Cumulative Best Per Question
            </span>
            <span className="text-outline">::</span>
            <span className="text-secondary">
              Total Ranked Teams: <strong className="text-primary-container">{activeLeaderboard.length}</strong>
            </span>
            <span className="text-outline">::</span>
            <span className="text-tertiary-fixed">
              Public Board: <strong className={contestState.leaderboard_frozen ? 'text-error' : 'text-tertiary-fixed'}>
                {contestState.leaderboard_frozen ? 'Frozen (Snapshot)' : 'Live'}
              </strong>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-space-sm flex-wrap z-10">
          <button 
            onClick={() => toggleLeaderboardFreeze()}
            className={`group px-space-md py-space-sm border-[3px] border-black shadow-[4px_4px_0px_#000000] hover:shadow-[2px_2px_0px_#000000] active:translate-x-1 active:translate-y-1 transition-none font-['Press_Start_2P'] text-[10px] flex items-center gap-2 ${
              contestState.leaderboard_frozen
                ? 'bg-error-container text-white'
                : 'bg-surface-container-high text-on-surface hover:bg-error-container hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] text-error group-hover:text-white">ac_unit</span>
            <span>{contestState.leaderboard_frozen ? 'Unfreeze Public' : 'Freeze Public'}</span>
          </button>

          <button 
            onClick={handleExport}
            className="group px-space-md py-space-sm bg-tertiary-fixed hover:bg-tertiary-container text-black border-[3px] border-black shadow-[4px_4px_0px_#000000] active:translate-x-1 active:translate-y-1 transition-none font-['Press_Start_2P'] text-[10px] flex items-center gap-2 font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </section>

      {/* TOP 3 ARCADE PODIUM SHOWCASE (Only if teams exist) */}
      {activeLeaderboard.length === 0 ? (
        <div className="bg-surface-container-lowest p-space-xl border-[4px] border-black shadow-[6px_6px_0px_#000000] flex flex-col items-center justify-center text-center gap-space-md">
          <span className="text-[48px]">🏆</span>
          <span className="font-['Press_Start_2P'] text-[14px] text-primary-container">
            NO TEAMS ON LEADERBOARD YET
          </span>
          <p className="font-['Courier_Prime'] text-[15px] text-on-surface-variant max-w-md">
            The leaderboard will populate in realtime as contestant teams join and submit verified prompt evaluations.
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-end">
          {/* #02 SILVER */}
          <div className="lg:col-span-4 order-2 lg:order-1 flex flex-col bg-surface-container border-[4px] border-black shadow-[6px_6px_0px_#000000] relative">
            <div className="h-8 bg-surface-container-lowest px-space-sm border-b-[3px] border-black flex items-center justify-between">
              <span className="font-['Press_Start_2P'] text-[10px] text-on-surface-variant">PODIUM_SLOT :: 02</span>
              <span className="font-['VT323'] text-[15px] text-outline">[2ND PLACE]</span>
            </div>
            <div className="p-space-md flex flex-col gap-space-sm bg-gradient-to-b from-surface-container to-surface-container-low">
              {second ? (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="font-['Press_Start_2P'] text-[24px] text-outline leading-tight drop-shadow-[2px_2px_0px_#000000]">#02</span>
                      <span className="font-['Press_Start_2P'] text-[13px] text-primary font-bold mt-1">{second.name}</span>
                      <span className="font-['Courier_Prime'] text-[13px] text-on-surface-variant mt-0.5">Code: {second.join_code}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-['VT323'] text-[28px] text-primary-container leading-none font-bold">{second.best_score.toLocaleString()} PTS</span>
                      <span className="font-['VT323'] text-[15px] text-on-surface-variant">{second.tab_switch_count} tab switches</span>
                    </div>
                  </div>
                  <div className="border-t-[2px] border-black pt-space-xs font-['Courier_Prime'] text-[12px] text-on-surface-variant">
                    Roster: {second.members?.map(m => m.display_name).join(', ') || 'No members'}
                  </div>
                </>
              ) : (
                <div className="p-space-md text-center font-['VT323'] text-[18px] text-outline italic">
                  Slot Open
                </div>
              )}
            </div>
          </div>

          {/* #01 GOLD CHAMPION (TALLEST CENTER PEDESTAL) */}
          <div className="lg:col-span-4 order-1 lg:order-2 flex flex-col bg-surface-container-high border-[4px] border-primary-container shadow-[8px_8px_0px_#000000,0px_0px_16px_rgba(0,240,255,0.35)] relative -translate-y-2 lg:-translate-y-4">
            <div className="h-9 bg-primary-container px-space-md border-b-[4px] border-black flex items-center justify-between">
              <span className="font-['Press_Start_2P'] text-[12px] text-black font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">military_tech</span>
                RANK #01 :: APEX_CHAMPION
              </span>
              <span className="font-['Press_Start_2P'] text-[9px] bg-black text-tertiary-fixed px-1.5 py-0.5 border border-black blink-fast">
                [HOLDING LEAD]
              </span>
            </div>
            <div className="p-space-lg flex flex-col gap-space-md bg-gradient-to-b from-surface-container-high via-surface-container to-surface-container-low">
              {first ? (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="font-['Press_Start_2P'] text-[32px] text-primary-container leading-none drop-shadow-[3px_3px_0px_#000000]">#01</span>
                      <span className="font-['Press_Start_2P'] text-[16px] text-primary font-bold mt-1">{first.name}</span>
                      <span className="font-['Courier_Prime'] text-[14px] text-on-surface-variant mt-0.5">Code: {first.join_code}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-['VT323'] text-[36px] text-tertiary-fixed font-bold leading-tight">{first.best_score.toLocaleString()} PTS</span>
                      <span className="font-['VT323'] text-[16px] text-primary">{first.tab_switch_count} tab switches</span>
                    </div>
                  </div>
                  <div className="border-t-[3px] border-black pt-space-xs font-['Courier_Prime'] text-[13px] text-on-surface">
                    Roster: {first.members?.map(m => m.display_name).join(', ') || 'No members'}
                  </div>
                </>
              ) : (
                <div className="p-space-md text-center font-['VT323'] text-[18px] text-outline italic">
                  Slot Open
                </div>
              )}
            </div>
          </div>

          {/* #03 BRONZE */}
          <div className="lg:col-span-4 order-3 flex flex-col bg-surface-container border-[4px] border-black shadow-[6px_6px_0px_#000000] relative">
            <div className="h-8 bg-surface-container-lowest px-space-sm border-b-[3px] border-black flex items-center justify-between">
              <span className="font-['Press_Start_2P'] text-[10px] text-on-surface-variant">PODIUM_SLOT :: 03</span>
              <span className="font-['VT323'] text-[15px] text-outline">[3RD PLACE]</span>
            </div>
            <div className="p-space-md flex flex-col gap-space-sm bg-gradient-to-b from-surface-container to-surface-container-low">
              {third ? (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="font-['Press_Start_2P'] text-[24px] text-secondary leading-tight drop-shadow-[2px_2px_0px_#000000]">#03</span>
                      <span className="font-['Press_Start_2P'] text-[13px] text-primary font-bold mt-1">{third.name}</span>
                      <span className="font-['Courier_Prime'] text-[13px] text-on-surface-variant mt-0.5">Code: {third.join_code}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-['VT323'] text-[28px] text-primary-container leading-none font-bold">{third.best_score.toLocaleString()} PTS</span>
                      <span className="font-['VT323'] text-[15px] text-on-surface-variant">{third.tab_switch_count} tab switches</span>
                    </div>
                  </div>
                  <div className="border-t-[2px] border-black pt-space-xs font-['Courier_Prime'] text-[12px] text-on-surface-variant">
                    Roster: {third.members?.map(m => m.display_name).join(', ') || 'No members'}
                  </div>
                </>
              ) : (
                <div className="p-space-md text-center font-['VT323'] text-[18px] text-outline italic">
                  Slot Open
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SEARCH BAR */}
      {activeLeaderboard.length > 3 && (
        <section className="bg-surface-container-lowest border-[4px] border-black shadow-[4px_4px_0px_#000000] p-space-sm flex items-center justify-between">
          <span className="font-['Press_Start_2P'] text-[10px] text-primary-container">
            RANKS #04 AND LOWER ({matrixTeams.length} TEAMS)
          </span>
          <div className="flex items-center gap-2 bg-surface-container-low border-[2px] border-black px-space-sm py-1 min-w-[280px]">
            <span className="text-tertiary-fixed font-['Press_Start_2P'] text-[10px]">&gt;</span>
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="SEARCH TEAM NAME OR CONTESTANT..."
              className="w-full bg-transparent text-on-surface placeholder:text-outline font-['Courier_Prime'] text-[14px] focus:outline-none uppercase"
            />
          </div>
        </section>
      )}

      {/* TABLE MATRIX FOR #04+ */}
      {activeLeaderboard.length > 3 && (
        <section className="bg-surface-container border-[4px] border-black shadow-[6px_6px_0px_#000000] flex flex-col">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest border-b-[3px] border-black font-['Space_Mono'] text-[11px] text-on-surface-variant uppercase select-none">
                  <th className="py-space-sm px-space-md w-16 text-center">RANK</th>
                  <th className="py-space-sm px-space-md min-w-[220px]">TEAM &amp; ROSTER</th>
                  <th className="py-space-sm px-space-md text-right">TOTAL PTS</th>
                  <th className="py-space-sm px-space-md text-center">JOIN CODE</th>
                  <th className="py-space-sm px-space-md text-center">TAB SWITCHES</th>
                </tr>
              </thead>
              <tbody className="divide-y-[2px] divide-black font-['Courier_Prime'] text-[14px]">
                {paginatedMatrix.map((team, idx) => {
                  const rank = 4 + (currentPage - 1) * pageSize + idx;
                  return (
                    <tr key={team.id} className="bg-surface-container hover:bg-surface-container-high transition-none">
                      <td className="py-space-sm px-space-md font-['Press_Start_2P'] text-[12px] text-center text-primary-container">
                        #{String(rank).padStart(2, '0')}
                      </td>
                      <td className="py-space-sm px-space-md">
                        <div className="flex flex-col">
                          <span className="font-['Space_Mono'] font-bold text-on-surface">{team.name}</span>
                          <span className="text-[12px] text-on-surface-variant">
                            {team.members?.map(m => m.display_name).join(', ') || 'No members enrolled'}
                          </span>
                        </div>
                      </td>
                      <td className="py-space-sm px-space-md text-right font-['VT323'] text-[24px] text-primary-container font-bold">
                        {team.best_score.toLocaleString()}
                      </td>
                      <td className="py-space-sm px-space-md text-center font-['Press_Start_2P'] text-[10px] text-tertiary-fixed">
                        {team.join_code}
                      </td>
                      <td className="py-space-sm px-space-md text-center font-['VT323'] text-[18px]">
                        <span className={team.tab_switch_count >= 3 ? 'text-error font-bold' : 'text-on-surface-variant'}>
                          {team.tab_switch_count}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {matrixTeams.length > 0 && (
            <div className="h-10 bg-surface-container-lowest border-t-[3px] border-black px-space-md flex items-center justify-between font-['VT323'] text-[17px] text-on-surface-variant">
              <div>
                SHOWING {matrixTeams.length} REGISTERED TEAMS
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2 py-0.5 bg-surface-container-high border border-black text-on-surface font-['Press_Start_2P'] text-[8px] disabled:opacity-40"
                >
                  &lt; PREV
                </button>
                <span className="text-primary-container font-['Press_Start_2P'] text-[9px] px-1">
                  PAGE {currentPage} OF {totalPages}
                </span>
                <button 
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2 py-0.5 bg-surface-container-high border border-black text-on-surface font-['Press_Start_2P'] text-[8px] disabled:opacity-40"
                >
                  NEXT &gt;
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
