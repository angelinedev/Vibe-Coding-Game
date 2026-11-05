import React, { useState, useMemo } from 'react';
import { useArena } from '../context/ArenaContext';
import { Team } from '../types/database';
import { ForgeQuestionModal } from '../components/ForgeQuestionModal';
import { BroadcastModal } from '../components/BroadcastModal';
import { ViewTeamModal } from '../components/ViewTeamModal';
import { playSound } from '../lib/audio';

export const DashboardView: React.FC = () => {
  const { 
    teams, 
    contestState, 
    auditLogs,
    onlineCount, 
    totalTeams, 
    disqualifiedCount, 
    topScore, 
    topTeamName,
    toggleLeaderboardFreeze, 
    setSelectedTeam,
    disqualifyTeam
  } = useArena();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'online' | 'flagged' | 'disqualified'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isForgeModalOpen, setIsForgeModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Filtered teams
  const filteredTeams = useMemo(() => {
    let result = [...teams];

    if (filterTab === 'online') {
      result = result.filter(t => t.is_online !== false && t.status !== 'disqualified');
    } else if (filterTab === 'flagged') {
      result = result.filter(t => t.tab_switch_count >= 3 && t.status !== 'disqualified');
    } else if (filterTab === 'disqualified') {
      result = result.filter(t => t.status === 'disqualified');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => 
        t.name.toLowerCase().includes(q) ||
        t.join_code.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.members?.some(m => m.display_name.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => b.best_score - a.best_score);
  }, [teams, filterTab, searchQuery]);

  const totalPages = Math.ceil(filteredTeams.length / pageSize) || 1;
  const paginatedTeams = filteredTeams.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const flaggedCount = useMemo(() => {
    return teams.filter(t => t.tab_switch_count >= 3 && t.status !== 'disqualified').length;
  }, [teams]);

  const activePercent = totalTeams > 0 ? Math.round((onlineCount / totalTeams) * 100) : 0;

  const exportCSV = () => {
    playSound.click();
    const headers = ['Rank', 'Team Name', 'Join Code', 'Status', 'Best Score', 'Tab Switches', 'Members'];
    const rows = filteredTeams.map((t, idx) => [
      idx + 1,
      `"${t.name}"`,
      `"${t.join_code}"`,
      t.status,
      t.best_score,
      t.tab_switch_count,
      t.members?.length || 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `arena_teams_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const latestLogMessage = auditLogs[0]?.message || 'Contest operations online. Awaiting telemetry.';

  return (
    <div className="flex flex-col w-full font-body-md text-on-surface">
      {/* SYSTEM COMMAND BANNER */}
      <div className="w-full bg-surface-container-lowest p-space-md shadow-[0_4px_0px_#000000] relative overflow-hidden border-b-[2px] border-black">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs font-['Press_Start_2P'] text-primary-container text-[14px] lg:text-[18px] tracking-wider drop-shadow-[2px_2px_0px_#000000]">
              <span className="text-secondary select-none">▶</span>
              <span>Live Contest Control</span>
              <span className="text-tertiary-fixed blink-fast inline-block">█</span>
            </div>
            <div className="flex items-center gap-space-sm font-['VT323'] text-[18px] text-on-surface-variant tracking-wide flex-wrap">
              <span className="text-tertiary-fixed font-bold">Operations Active</span>
              <span className="text-outline">/</span>
              <span>Contest Status: <strong className="text-primary-container uppercase">{contestState.status.replace('_', ' ')}</strong></span>
              {contestState.current_broadcast && (
                <>
                  <span className="text-outline">/</span>
                  <span className="text-secondary truncate max-w-md">
                    Broadcast: "{contestState.current_broadcast}"
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-space-sm">
            <button 
              onClick={() => {
                playSound.click();
                setIsForgeModalOpen(true);
              }}
              className="px-space-md py-space-sm bg-primary-container text-black font-['Press_Start_2P'] text-[10px] uppercase shadow-[4px_4px_0px_#000000] hover:bg-tertiary-fixed active:translate-x-1 active:translate-y-1 transition-none flex items-center gap-2 font-bold"
            >
              <span className="material-symbols-outlined text-[16px]">add_box</span>
              <span>+ New Question</span>
            </button>

            <button 
              onClick={() => toggleLeaderboardFreeze()}
              className={`px-space-md py-space-sm ${
                contestState.leaderboard_frozen ? 'bg-error-container text-white' : 'bg-surface-container-high text-secondary'
              } font-['Press_Start_2P'] text-[10px] uppercase shadow-[4px_4px_0px_#000000] hover:bg-secondary hover:text-black active:translate-x-1 active:translate-y-1 transition-none flex items-center gap-2`}
            >
              <span className="material-symbols-outlined text-[16px]">lock_clock</span>
              <span>{contestState.leaderboard_frozen ? 'Unfreeze Board' : 'Freeze Leaderboard'}</span>
            </button>

            <button 
              onClick={() => {
                playSound.click();
                setIsBroadcastModalOpen(true);
              }}
              className="px-space-md py-space-sm bg-secondary-container text-on-secondary-container font-['Press_Start_2P'] text-[10px] uppercase shadow-[4px_4px_0px_#000000] hover:bg-on-secondary-fixed hover:text-white active:translate-x-1 active:translate-y-1 transition-none flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">campaign</span>
              <span>Broadcast Notice</span>
            </button>
          </div>
        </div>
      </div>

      {/* HUD STAT CARDS (GRID OF 4 RETRO JRPG DIALOGS) */}
      <div className="p-space-lg grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* CARD 1: TEAMS ONLINE */}
        <div className="bg-surface-container-low shadow-[4px_4px_0px_#000000] flex flex-col justify-between relative border border-black/40">
          <div className="h-8 bg-surface-container-lowest px-space-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-tertiary-fixed inline-block"></span>
              <span className="font-['Press_Start_2P'] text-[10px] text-tertiary-fixed tracking-wider">TEAMS ACTIVE</span>
            </div>
            <span className="font-['Press_Start_2P'] text-[9px] text-outline">[ 01 ]</span>
          </div>
          <div className="p-space-md flex flex-col gap-space-xs bg-surface-container-low">
            <div className="flex items-center justify-between">
              <div className="font-['VT323'] text-[52px] leading-none text-tertiary-fixed drop-shadow-[3px_3px_0px_#000000] tracking-tight">
                {onlineCount} <span className="text-[28px] text-on-surface-variant font-normal">/ {totalTeams}</span>
              </div>
              <span className="material-symbols-outlined text-[42px] text-tertiary-fixed">sports_esports</span>
            </div>
            <div className="w-full bg-surface-container-highest h-3 shadow-[inset_2px_2px_0px_#000000] p-0.5 flex gap-1">
              <div className="h-full bg-tertiary-fixed" style={{ width: `${activePercent}%` }}></div>
              <div className="h-full bg-surface-variant flex-1"></div>
            </div>
            <div className="flex items-center justify-between mt-1 font-['Press_Start_2P'] text-[9px]">
              <span className="text-tertiary-fixed">{activePercent}% ACTIVE</span>
              <span className="text-on-surface-variant">CHECK-IN RATIO</span>
            </div>
          </div>
        </div>

        {/* CARD 2: TOTAL TEAMS */}
        <div className="bg-surface-container-low shadow-[4px_4px_0px_#000000] flex flex-col justify-between relative border border-black/40">
          <div className="h-8 bg-surface-container-lowest px-space-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-primary-container inline-block"></span>
              <span className="font-['Press_Start_2P'] text-[10px] text-primary-container tracking-wider">TOTAL TEAMS</span>
            </div>
            <span className="font-['Press_Start_2P'] text-[9px] text-outline">[ 02 ]</span>
          </div>
          <div className="p-space-md flex flex-col gap-space-xs bg-surface-container-low">
            <div className="flex items-center justify-between">
              <div className="font-['VT323'] text-[52px] leading-none text-primary-container drop-shadow-[3px_3px_0px_#000000]">
                {totalTeams} <span className="text-[24px] text-primary-fixed-dim">ROSTER</span>
              </div>
              <span className="material-symbols-outlined text-[42px] text-primary-container">groups</span>
            </div>
            <div className="w-full bg-surface-container-highest h-3 shadow-[inset_2px_2px_0px_#000000] p-0.5 flex gap-1">
              <div className="h-full bg-primary-container" style={{ width: totalTeams > 0 ? '100%' : '0%' }}></div>
            </div>
            <div className="flex items-center justify-between mt-1 font-['Press_Start_2P'] text-[9px]">
              <span className="text-primary-container">REGISTERED</span>
              <span className="text-on-surface-variant font-['VT323'] text-[14px]">ROSTER SIZE</span>
            </div>
          </div>
        </div>

        {/* CARD 3: DISQUALIFIED */}
        <div className="bg-surface-container-low shadow-[4px_4px_0px_#000000] flex flex-col justify-between relative border border-black/40">
          <div className="h-8 bg-surface-container-lowest px-space-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-error inline-block blink-fast"></span>
              <span className="font-['Press_Start_2P'] text-[10px] text-error tracking-wider">DISQUALIFIED</span>
            </div>
            <span className="font-['Press_Start_2P'] text-[9px] text-outline">[ 03 ]</span>
          </div>
          <div className="p-space-md flex flex-col gap-space-xs bg-surface-container-low">
            <div className="flex items-center justify-between">
              <div className="font-['VT323'] text-[52px] leading-none text-error drop-shadow-[3px_3px_0px_#000000]">
                {String(disqualifiedCount).padStart(2, '0')} <span className="text-[20px] text-on-error-container">EXPELLED</span>
              </div>
              <span className="material-symbols-outlined text-[42px] text-error">skull</span>
            </div>
            <div className="w-full bg-surface-container-highest h-3 shadow-[inset_2px_2px_0px_#000000] p-0.5 flex gap-1">
              <div className="h-full bg-error" style={{ width: totalTeams > 0 ? `${(disqualifiedCount / totalTeams) * 100}%` : '0%' }}></div>
              <div className="h-full bg-surface-container-lowest flex-1"></div>
            </div>
            <div className="flex items-center justify-between mt-1 font-['Press_Start_2P'] text-[9px]">
              <span className="text-error">{flaggedCount} FLAGGED (&gt;=3 TABS)</span>
              <span className="text-on-surface-variant font-['VT323'] text-[14px]">PROCTOR ALERT</span>
            </div>
          </div>
        </div>

        {/* CARD 4: TOP SCORE */}
        <div className="bg-surface-container-low shadow-[4px_4px_0px_#000000] flex flex-col justify-between relative border border-black/40">
          <div className="h-8 bg-surface-container-lowest px-space-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-secondary inline-block"></span>
              <span className="font-['Press_Start_2P'] text-[10px] text-secondary tracking-wider">TOP SCORE</span>
            </div>
            <span className="font-['Press_Start_2P'] text-[9px] text-outline">[ 04 ]</span>
          </div>
          <div className="p-space-md flex flex-col gap-space-xs bg-surface-container-low">
            <div className="flex items-center justify-between">
              <div className="font-['VT323'] text-[52px] leading-none text-secondary drop-shadow-[3px_3px_0px_#000000]">
                {topScore.toLocaleString()} <span className="text-[22px] text-on-surface-variant">PTS</span>
              </div>
              <span className="material-symbols-outlined text-[42px] text-secondary">workspace_premium</span>
            </div>
            <div className="w-full bg-surface-container-highest h-3 shadow-[inset_2px_2px_0px_#000000] p-0.5 flex gap-1">
              <div className="h-full bg-secondary" style={{ width: topScore > 0 ? '100%' : '0%' }}></div>
            </div>
            <div className="flex items-center justify-between mt-1 font-['Press_Start_2P'] text-[9px]">
              <span className="text-secondary truncate max-w-[160px]">★ {topTeamName}</span>
              <span className="text-tertiary-fixed font-['VT323'] text-[14px]">CURRENT #1</span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROL DECK: SEARCH & TABS */}
      <div className="px-space-lg pb-space-md flex flex-col gap-space-md">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md shadow-[4px_4px_0px_#000000] border border-black">
          {/* Search Input */}
          <div className="flex-1 flex items-center bg-surface-container-low shadow-[inset_2px_2px_0px_#000000] px-space-md py-space-sm gap-space-sm border border-black">
            <span className="material-symbols-outlined text-primary-container text-[20px]">search</span>
            <span className="font-['Press_Start_2P'] text-primary-container text-[11px] select-none">QUERY &gt;</span>
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="SEARCH TEAM NAME, JOIN CODE, OR CONTESTANT..."
              className="bg-transparent text-on-surface font-['Courier_Prime'] text-[15px] focus:outline-none flex-1 placeholder:text-outline-variant caret-tertiary-fixed tracking-wide uppercase"
            />
          </div>

          <div className="flex items-center gap-space-sm self-end lg:self-auto">
            <button 
              onClick={exportCSV}
              className="px-space-md py-space-sm bg-surface-container-high text-on-surface font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-surface-container-highest active:translate-x-0.5 active:translate-y-0.5 transition-none flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>EXPORT CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-space-sm">
          <button 
            onClick={() => setFilterTab('all')}
            className={`px-space-md py-space-xs font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] border border-black transition-none flex items-center gap-2 ${
              filterTab === 'all' ? 'bg-primary-container text-black font-bold' : 'bg-surface-container-low text-on-surface'
            }`}
          >
            <span>ALL ({teams.length})</span>
          </button>
          <button 
            onClick={() => setFilterTab('online')}
            className={`px-space-md py-space-xs font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] border border-black transition-none flex items-center gap-2 ${
              filterTab === 'online' ? 'bg-primary-container text-black font-bold' : 'bg-surface-container-low text-tertiary-fixed'
            }`}
          >
            <span className="w-2 h-2 bg-tertiary-fixed inline-block"></span>
            <span>ACTIVE ({onlineCount})</span>
          </button>
          <button 
            onClick={() => setFilterTab('flagged')}
            className={`px-space-md py-space-xs font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] border border-black transition-none flex items-center gap-2 ${
              filterTab === 'flagged' ? 'bg-primary-container text-black font-bold' : 'bg-surface-container-low text-secondary'
            }`}
          >
            <span className="material-symbols-outlined text-[14px] text-secondary">warning</span>
            <span>FLAGGED / 3+ TABS ({flaggedCount})</span>
          </button>
          <button 
            onClick={() => setFilterTab('disqualified')}
            className={`px-space-md py-space-xs font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] border border-black transition-none flex items-center gap-2 ${
              filterTab === 'disqualified' ? 'bg-primary-container text-black font-bold' : 'bg-surface-container-low text-error'
            }`}
          >
            <span className="material-symbols-outlined text-[14px] text-error">dangerous</span>
            <span>DISQUALIFIED ({disqualifiedCount})</span>
          </button>
        </div>
      </div>

      {/* TEAMS MONITORING TABLE */}
      <div className="px-space-lg pb-space-xl">
        <div className="bg-surface-container-lowest shadow-[6px_6px_0px_#000000] overflow-hidden flex flex-col border border-black">
          {/* Header Bar */}
          <div className="bg-surface-container-low px-space-md py-space-sm flex items-center justify-between border-b-[2px] border-black">
            <div className="flex items-center gap-space-sm">
              <span className="font-['Press_Start_2P'] text-primary-container text-[11px] tracking-widest uppercase font-bold">
                PROCTOR &amp; SCORE MONITOR MATRIX
              </span>
              <span className="px-space-xs py-0.5 bg-surface-container-highest text-tertiary-fixed font-['VT323'] text-[15px]">
                TELEMETRY: REALTIME
              </span>
            </div>
            <div className="flex items-center gap-2 font-['VT323'] text-[16px] text-on-surface-variant">
              <span>SORT: SCORE [DESC]</span>
              <span className="text-primary-container font-bold">▲</span>
            </div>
          </div>

          {/* Table or Empty State */}
          {filteredTeams.length === 0 ? (
            <div className="p-space-xl flex flex-col items-center justify-center text-center gap-space-sm my-space-md">
              <span className="text-[36px]">📋</span>
              <span className="font-['Press_Start_2P'] text-[12px] text-primary-container">
                {teams.length === 0 ? 'NO TEAMS REGISTERED YET' : 'NO TEAMS MATCH QUERY'}
              </span>
              <span className="font-['Courier_Prime'] text-[14px] text-on-surface-variant max-w-sm">
                {teams.length === 0 
                  ? 'Use the TEAMS menu tab to create or bulk-generate team join codes.'
                  : 'Try clearing your search query or switching filter tabs.'}
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse select-none">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-['Press_Start_2P'] text-[9px] uppercase tracking-wider border-b-[2px] border-black">
                    <th className="py-space-sm px-space-md w-24">RANK</th>
                    <th className="py-space-sm px-space-md">TEAM IDENTITY</th>
                    <th className="py-space-sm px-space-md w-36">JOIN CODE</th>
                    <th className="py-space-sm px-space-md w-36">MEMBERS</th>
                    <th className="py-space-sm px-space-md w-36 text-right">BEST SCORE</th>
                    <th className="py-space-sm px-space-md w-60">TAB SWITCHES</th>
                    <th className="py-space-sm px-space-md w-44 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/40 font-['VT323'] text-[18px]">
                  {paginatedTeams.map((team, idx) => {
                    const globalRank = (currentPage - 1) * pageSize + idx + 1;
                    const isDQ = team.status === 'disqualified';
                    const memberCount = team.members?.length || 0;

                    return (
                      <tr 
                        key={team.id}
                        className={`team-row group hover:bg-[#341E61] transition-none ${
                          isDQ ? 'bg-[#251025] opacity-75' : idx % 2 === 0 ? 'bg-[#251646]' : 'bg-[#1C1137]'
                        }`}
                      >
                        <td className="py-space-sm px-space-md">
                          <div className="flex items-center gap-1.5 font-['Press_Start_2P'] text-[11px] text-secondary">
                            <span>#{String(globalRank).padStart(2, '0')}</span>
                          </div>
                        </td>

                        <td className="py-space-sm px-space-md">
                          <div className="flex items-center gap-space-sm">
                            <div className="w-7 h-7 bg-surface-container-lowest flex items-center justify-center text-primary-container shadow-[2px_2px_0px_#000000]">
                              <span className="material-symbols-outlined text-[18px]">terminal</span>
                            </div>
                            <div className="flex flex-col">
                              <span className={`font-['Press_Start_2P'] text-[11px] group-hover:text-tertiary-fixed ${
                                isDQ ? 'line-through text-outline' : 'text-primary-container'
                              }`}>
                                {team.name}
                              </span>
                              <span className="text-[14px] text-on-surface-variant font-['Courier_Prime']">
                                {memberCount > 0 
                                  ? team.members?.map(m => m.display_name).join(', ')
                                  : 'No members enrolled yet'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-space-sm px-space-md">
                          <span className="font-['Press_Start_2P'] text-[10px] text-tertiary-fixed tracking-wider select-all">
                            {team.join_code}
                          </span>
                        </td>

                        <td className="py-space-sm px-space-md">
                          <span className="px-space-xs py-0.5 bg-surface-container-lowest text-on-surface font-['Press_Start_2P'] text-[9px] shadow-[2px_2px_0px_#000000]">
                            {memberCount} / {team.max_members}
                          </span>
                        </td>

                        <td className="py-space-sm px-space-md text-right">
                          <span className={`text-[26px] tracking-wider font-bold ${
                            isDQ ? 'text-outline line-through' : 'text-secondary'
                          }`}>
                            {team.best_score.toLocaleString()}
                          </span>
                        </td>

                        <td className="py-space-sm px-space-md">
                          <div className="flex items-center gap-space-sm">
                            <span className={`px-space-xs py-0.5 bg-surface-container-lowest font-['Press_Start_2P'] text-[8px] shadow-[2px_2px_0px_#000000] ${
                              team.tab_switch_count >= 3 ? 'text-error' : 'text-tertiary-fixed'
                            }`}>
                              {team.tab_switch_count} {team.tab_switch_count >= 3 ? 'FLAGGED' : 'CLEAN'}
                            </span>
                            <div className="w-20 bg-surface-container-high h-2 shadow-[inset_1px_1px_0px_#000000]">
                              <div 
                                className={`h-full ${team.tab_switch_count >= 3 ? 'bg-error' : 'bg-tertiary-fixed'}`}
                                style={{ width: `${Math.min(100, team.tab_switch_count * 20)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td className="py-space-sm px-space-md text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => setSelectedTeam(team)}
                              className="px-space-xs py-1 bg-primary-container text-black font-['Press_Start_2P'] text-[8px] shadow-[2px_2px_0px_#000000] hover:bg-tertiary-fixed active:translate-x-0.5 active:translate-y-0.5 font-bold"
                            >
                              [VIEW]
                            </button>

                            {team.status === 'active' && (
                              <button 
                                onClick={() => {
                                  if (window.confirm(`Disqualify team "${team.name}"?`)) {
                                    disqualifyTeam(team.id);
                                  }
                                }}
                                className="px-space-xs py-1 bg-surface-container-high text-error font-['Press_Start_2P'] text-[8px] shadow-[2px_2px_0px_#000000] hover:bg-error hover:text-black active:translate-x-0.5 active:translate-y-0.5"
                              >
                                [DQ]
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {filteredTeams.length > 0 && (
            <div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-md shadow-[inset_0px_2px_0px_#000000] border-t-[2px] border-black">
              <div className="font-['VT323'] text-[18px] text-on-surface-variant flex items-center gap-2">
                <span>
                  SHOWING <strong className="text-primary-container">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredTeams.length)}</strong> OF <strong className="text-primary-container">{filteredTeams.length} TEAMS</strong>
                </span>
              </div>
              <div className="flex items-center gap-space-sm font-['Press_Start_2P'] text-[10px]">
                <button 
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-space-md py-space-sm bg-surface-container-high text-on-surface-variant shadow-[3px_3px_0px_#000000] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ◄ PREV
                </button>
                <div className="px-space-md py-space-sm bg-surface-container-lowest text-primary-container shadow-[inset_2px_2px_0px_#000000] border border-black">
                  PAGE {currentPage} OF {totalPages}
                </div>
                <button 
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-space-md py-space-sm bg-primary-container text-black shadow-[3px_3px_0px_#000000] hover:bg-tertiary-fixed disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                >
                  NEXT ►
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TERMINAL MINI TICKER */}
      <div className="px-space-lg pb-space-lg">
        <div className="bg-surface-container-lowest p-space-sm shadow-[4px_4px_0px_#000000] flex flex-col md:flex-row items-center justify-between gap-space-sm border border-black">
          <div className="flex items-center gap-space-sm overflow-hidden w-full">
            <span className="px-space-xs py-0.5 bg-surface-container-high text-secondary font-['Press_Start_2P'] text-[8px] uppercase">SYS_LOG</span>
            <div className="font-['VT323'] text-[17px] text-tertiary-fixed truncate">
              {latestLogMessage}
            </div>
          </div>
          <div className="font-['Press_Start_2P'] text-[8px] text-outline whitespace-nowrap">
            LOGS BUFFERED: {auditLogs.length}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ForgeQuestionModal isOpen={isForgeModalOpen} onClose={() => setIsForgeModalOpen(false)} />
      <BroadcastModal isOpen={isBroadcastModalOpen} onClose={() => setIsBroadcastModalOpen(false)} />
      <ViewTeamModal />
    </div>
  );
};
