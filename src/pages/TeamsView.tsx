import React, { useState, useMemo } from 'react';
import { useArena } from '../context/ArenaContext';
import { Team } from '../types/database';
import { playSound } from '../lib/audio';

export const TeamsView: React.FC = () => {
  const { 
    teams, 
    createTeam, 
    bulkCreateTeams, 
    regenerateJoinCode, 
    toggleJoinLock, 
    kickTeamMember, 
    disqualifyTeam 
  } = useArena();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'locked' | 'disqualified'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamMaxMembers, setNewTeamMaxMembers] = useState(3);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkPrefix, setBulkPrefix] = useState('Team');

  // Filtered teams
  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      if (filterStatus === 'active' && (team.status !== 'active' || team.join_locked)) return false;
      if (filterStatus === 'locked' && !team.join_locked) return false;
      if (filterStatus === 'disqualified' && team.status !== 'disqualified') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = team.name.toLowerCase().includes(q);
        const matchesCode = team.join_code.toLowerCase().includes(q);
        const matchesMember = team.members?.some(m => m.display_name.toLowerCase().includes(q));
        return matchesName || matchesCode || matchesMember;
      }
      return true;
    });
  }, [teams, filterStatus, searchQuery]);

  const totalMembers = useMemo(() => {
    return teams.reduce((acc, t) => acc + (t.members?.length || 0), 0);
  }, [teams]);

  const lockedCount = useMemo(() => {
    return teams.filter(t => t.join_locked).length;
  }, [teams]);

  const disqualifiedCount = useMemo(() => {
    return teams.filter(t => t.status === 'disqualified').length;
  }, [teams]);

  const handleCopyCode = (code: string) => {
    playSound.click();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    await createTeam(newTeamName.trim(), newTeamMaxMembers);
    setNewTeamName('');
    setIsCreateModalOpen(false);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkCount < 1) return;
    await bulkCreateTeams(bulkCount, bulkPrefix.trim() || 'Team', 3);
    setIsBulkModalOpen(false);
  };

  const exportCSV = () => {
    playSound.click();
    const headers = ['Team Name', 'Join Code', 'Status', 'Members Enrolled', 'Max Members', 'Join Locked', 'Total Tab Switches', 'Best Score'];
    const rows = teams.map(t => [
      `"${t.name}"`,
      `"${t.join_code}"`,
      t.status,
      t.members?.length || 0,
      t.max_members,
      t.join_locked ? 'LOCKED' : 'OPEN',
      t.tab_switch_count,
      t.best_score
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `prompt_arena_join_codes_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full p-gutter gap-space-lg text-on-surface">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest p-space-md shadow-[4px_4px_0px_#000000] flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border border-black">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs">
            <span className="w-3 h-3 bg-primary-container shadow-[1px_1px_0px_#000000] inline-block"></span>
            <h1 className="font-['Press_Start_2P'] text-[16px] text-primary-container uppercase tracking-wider">
              TEAMS &amp; JOIN CODES REGISTRY
            </h1>
          </div>
          <div className="font-['VT323'] text-[18px] text-on-surface-variant flex items-center gap-2 flex-wrap">
            <span className="text-tertiary-fixed font-bold">MULTI-DEVICE ROSTERS ACTIVE</span>
            <span className="text-outline">::</span>
            <span>MAX 3 MEMBERS PER CODE</span>
            <span className="text-outline">::</span>
            <span>TOTAL ENROLLED CONTESTANTS: <strong className="text-primary-container">{totalMembers}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-space-sm">
          <button 
            onClick={() => {
              playSound.click();
              setIsCreateModalOpen(true);
            }}
            className="px-space-md py-space-sm bg-primary-container text-black font-['Press_Start_2P'] text-[10px] uppercase shadow-[4px_4px_0px_#000000] hover:bg-tertiary-fixed active:translate-x-1 active:translate-y-1 transition-none flex items-center gap-2 font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">add_box</span>
            <span>Create Team</span>
          </button>

          <button 
            onClick={() => {
              playSound.click();
              setIsBulkModalOpen(true);
            }}
            className="px-space-md py-space-sm bg-surface-container-high text-on-surface font-['Press_Start_2P'] text-[10px] uppercase shadow-[4px_4px_0px_#000000] hover:bg-surface-bright active:translate-x-1 active:translate-y-1 transition-none flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">group_add</span>
            <span>Bulk Generate</span>
          </button>

          <button 
            onClick={exportCSV}
            className="px-space-md py-space-sm bg-tertiary-fixed text-black font-['Press_Start_2P'] text-[10px] uppercase shadow-[4px_4px_0px_#000000] hover:bg-tertiary active:translate-x-1 active:translate-y-1 transition-none flex items-center gap-2 font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Cards (Real Values) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="bg-surface-container-low p-space-md shadow-[4px_4px_0px_#000000] border border-black flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['Press_Start_2P'] text-[10px] text-primary-container">TOTAL TEAMS</span>
            <span className="material-symbols-outlined text-primary-container text-[20px]">groups</span>
          </div>
          <div className="font-['VT323'] text-[48px] text-primary-container leading-none my-2 font-bold">
            {teams.length}
          </div>
          <span className="font-['Press_Start_2P'] text-[8px] text-on-surface-variant">REGISTERED ROSTERS</span>
        </div>

        <div className="bg-surface-container-low p-space-md shadow-[4px_4px_0px_#000000] border border-black flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['Press_Start_2P'] text-[10px] text-tertiary-fixed">MEMBERS ENROLLED</span>
            <span className="material-symbols-outlined text-tertiary-fixed text-[20px]">person</span>
          </div>
          <div className="font-['VT323'] text-[48px] text-tertiary-fixed leading-none my-2 font-bold">
            {totalMembers}
          </div>
          <span className="font-['Press_Start_2P'] text-[8px] text-on-surface-variant">PARTICIPATING DEVICES</span>
        </div>

        <div className="bg-surface-container-low p-space-md shadow-[4px_4px_0px_#000000] border border-black flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['Press_Start_2P'] text-[10px] text-secondary">LOCKED TEAMS</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">lock</span>
          </div>
          <div className="font-['VT323'] text-[48px] text-secondary leading-none my-2 font-bold">
            {lockedCount}
          </div>
          <span className="font-['Press_Start_2P'] text-[8px] text-on-surface-variant">JOIN CODES DISABLED</span>
        </div>

        <div className="bg-surface-container-low p-space-md shadow-[4px_4px_0px_#000000] border border-black flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['Press_Start_2P'] text-[10px] text-error">DISQUALIFIED</span>
            <span className="material-symbols-outlined text-error text-[20px]">skull</span>
          </div>
          <div className="font-['VT323'] text-[48px] text-error leading-none my-2 font-bold">
            {disqualifiedCount}
          </div>
          <span className="font-['Press_Start_2P'] text-[8px] text-on-surface-variant">EXPELLED SESSIONS</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-low p-space-sm shadow-[4px_4px_0px_#000000] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-space-sm border border-black">
        <div className="flex flex-wrap items-center gap-1.5 font-['Press_Start_2P'] text-[9px]">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-space-sm py-1.5 border-[2px] border-black ${
              filterStatus === 'all' ? 'bg-primary-container text-black font-bold' : 'bg-surface-container-lowest text-on-surface'
            }`}
          >
            ALL ({teams.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-space-sm py-1.5 border-[2px] border-black ${
              filterStatus === 'active' ? 'bg-tertiary-fixed text-black font-bold' : 'bg-surface-container-lowest text-tertiary-fixed'
            }`}
          >
            OPEN JOIN ({teams.filter(t => t.status === 'active' && !t.join_locked).length})
          </button>
          <button
            onClick={() => setFilterStatus('locked')}
            className={`px-space-sm py-1.5 border-[2px] border-black ${
              filterStatus === 'locked' ? 'bg-secondary text-black font-bold' : 'bg-surface-container-lowest text-secondary'
            }`}
          >
            LOCKED ({lockedCount})
          </button>
          <button
            onClick={() => setFilterStatus('disqualified')}
            className={`px-space-sm py-1.5 border-[2px] border-black ${
              filterStatus === 'disqualified' ? 'bg-error text-white font-bold' : 'bg-surface-container-lowest text-error'
            }`}
          >
            DISQUALIFIED ({disqualifiedCount})
          </button>
        </div>

        <div className="flex items-center gap-2 bg-surface-container-lowest border-[2px] border-black px-space-sm py-1 min-w-[280px]">
          <span className="font-['Press_Start_2P'] text-primary-container text-[10px]">&gt;</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="SEARCH BY TEAM, CODE, OR CONTESTANT..."
            className="w-full bg-transparent text-primary font-['Courier_Prime'] text-[14px] focus:outline-none uppercase"
          />
        </div>
      </div>

      {/* Teams Grid List */}
      {filteredTeams.length === 0 ? (
        <div className="bg-surface-container-lowest p-space-xl border-[4px] border-black shadow-[6px_6px_0px_#000000] flex flex-col items-center justify-center text-center gap-space-md my-space-lg">
          <span className="text-[48px]">👾</span>
          <div className="font-['Press_Start_2P'] text-[14px] text-primary-container">
            NO TEAMS FOUND
          </div>
          <p className="font-['Courier_Prime'] text-[15px] text-on-surface-variant max-w-md">
            {teams.length === 0 
              ? 'No teams have been created yet. Click "+ Create Team" or "+ Bulk Generate" to produce join codes for participants.'
              : 'No teams match your current search or filter query.'}
          </p>
          {teams.length === 0 && (
            <div className="flex items-center gap-space-sm mt-2">
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="px-space-md py-space-sm bg-primary-container text-black font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-tertiary-fixed"
              >
                [+ CREATE SINGLE TEAM]
              </button>
              <button 
                onClick={() => setIsBulkModalOpen(true)}
                className="px-space-md py-space-sm bg-tertiary-fixed text-black font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-tertiary font-bold"
              >
                [+ BULK GENERATE 10 TEAMS]
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
          {filteredTeams.map((team) => {
            const memberCount = team.members?.length || 0;
            const isFull = memberCount >= team.max_members;

            return (
              <div 
                key={team.id}
                className={`bg-surface-container-low border-[3px] border-black shadow-[4px_4px_0px_#000000] flex flex-col justify-between ${
                  team.status === 'disqualified' ? 'opacity-70 bg-[#251025]' : ''
                }`}
              >
                {/* Team Card Header */}
                <div className="bg-surface-container-lowest px-space-md py-space-sm border-b-[2px] border-black flex items-center justify-between">
                  <div className="flex items-center gap-space-sm">
                    <span className="font-['Press_Start_2P'] text-[12px] text-primary-container font-bold">
                      {team.name}
                    </span>
                    {team.status === 'disqualified' && (
                      <span className="px-1.5 py-0.5 bg-error text-black font-['Press_Start_2P'] text-[8px] uppercase">
                        DQ'D
                      </span>
                    )}
                    {team.join_locked && team.status !== 'disqualified' && (
                      <span className="px-1.5 py-0.5 bg-secondary text-black font-['Press_Start_2P'] text-[8px] uppercase">
                        LOCKED
                      </span>
                    )}
                  </div>

                  <div className="font-['VT323'] text-[18px] text-on-surface-variant flex items-center gap-2">
                    <span>SCORE: <strong className="text-secondary">{team.best_score}</strong></span>
                    <span>|</span>
                    <span className={team.tab_switch_count >= 3 ? 'text-error' : 'text-tertiary-fixed'}>
                      TABS: {team.tab_switch_count}
                    </span>
                  </div>
                </div>

                {/* Team Join Code Banner */}
                <div className="p-space-md bg-surface-container flex flex-col gap-space-sm">
                  <div className="bg-surface-container-lowest border-[2px] border-black p-space-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm shadow-[inset_2px_2px_0px_#000000]">
                    <div className="flex flex-col">
                      <span className="font-['Press_Start_2P'] text-[8px] text-outline uppercase tracking-wider">
                        ENTRY JOIN CODE
                      </span>
                      <span className="font-['Press_Start_2P'] text-[16px] text-tertiary-fixed tracking-widest my-1 select-all">
                        {team.join_code}
                      </span>
                      <span className="font-['VT323'] text-[14px] text-on-surface-variant">
                        SHARE THIS CODE WITH UP TO {team.max_members} TEAM MEMBERS
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
                      <button
                        onClick={() => handleCopyCode(team.join_code)}
                        className="px-space-sm py-1 bg-primary-container text-black font-['Press_Start_2P'] text-[8px] uppercase shadow-[2px_2px_0px_#000000] hover:bg-tertiary-fixed active:translate-y-0.5 font-bold"
                      >
                        {copiedCode === team.join_code ? 'COPIED!' : 'COPY CODE'}
                      </button>

                      <button
                        onClick={() => toggleJoinLock(team.id)}
                        className={`px-space-sm py-1 border-[2px] border-black font-['Press_Start_2P'] text-[8px] uppercase shadow-[2px_2px_0px_#000000] active:translate-y-0.5 ${
                          team.join_locked 
                            ? 'bg-secondary text-black' 
                            : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
                        }`}
                      >
                        {team.join_locked ? 'UNLOCK' : 'LOCK'}
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm(`Regenerate join code for ${team.name}? Existing unjoined code will be invalidated.`)) {
                            regenerateJoinCode(team.id);
                          }
                        }}
                        className="px-space-sm py-1 bg-surface-container-high text-outline hover:text-white border-[2px] border-black font-['Press_Start_2P'] text-[8px] uppercase shadow-[2px_2px_0px_#000000] active:translate-y-0.5"
                        title="Regenerate Join Code"
                      >
                        REGEN
                      </button>
                    </div>
                  </div>

                  {/* Members Roster Section */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between font-['VT323'] text-[16px] text-on-surface-variant">
                      <span>MEMBERS ENROLLED ({memberCount} / {team.max_members})</span>
                      <span className={isFull ? 'text-secondary' : 'text-tertiary-fixed'}>
                        {isFull ? '[SLOTS FULL]' : `[${team.max_members - memberCount} SLOTS OPEN]`}
                      </span>
                    </div>

                    {memberCount === 0 ? (
                      <div className="p-space-sm bg-surface-container-lowest border border-black/40 font-['VT323'] text-[16px] text-outline italic text-center">
                        Awaiting contestants to enter join code from their device...
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {team.members?.map(m => (
                          <div 
                            key={m.id}
                            className="p-space-xs px-space-sm bg-surface-container-lowest border border-black flex items-center justify-between text-[14px] font-['Courier_Prime']"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-tertiary-fixed inline-block"></span>
                              <span className="font-bold text-on-surface">{m.display_name}</span>
                              <span className="font-['VT323'] text-[15px] text-on-surface-variant">
                                ({m.tab_switch_count} tab switches)
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                if (window.confirm(`Kick member "${m.display_name}" from team "${team.name}"?`)) {
                                  kickTeamMember(team.id, m.id);
                                }
                              }}
                              className="px-1.5 py-0.5 bg-surface-container-high text-error hover:bg-error hover:text-black font-['Press_Start_2P'] text-[7px] border border-black active:translate-y-0.5"
                            >
                              [KICK]
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Footer Actions */}
                <div className="bg-surface-container-lowest px-space-md py-space-xs border-t-[2px] border-black flex items-center justify-between">
                  <span className="font-['VT323'] text-[14px] text-outline">
                    CREATED: {new Date(team.created_at).toLocaleDateString()}
                  </span>

                  {team.status === 'active' ? (
                    <button
                      onClick={() => {
                        if (window.confirm(`Disqualify team "${team.name}" from the tournament?`)) {
                          disqualifyTeam(team.id);
                        }
                      }}
                      className="px-space-sm py-0.5 bg-surface-container-high text-error hover:bg-error hover:text-black font-['Press_Start_2P'] text-[8px] uppercase border border-black active:translate-y-0.5"
                    >
                      [DISQUALIFY TEAM]
                    </button>
                  ) : (
                    <span className="font-['Press_Start_2P'] text-[8px] text-error">
                      DISQUALIFIED BY ADMIN
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE TEAM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container border-[4px] border-black shadow-[8px_8px_0px_#000000] flex flex-col">
            <div className="bg-surface-container-lowest px-space-md py-space-sm border-b-[3px] border-black flex items-center justify-between">
              <span className="font-['Press_Start_2P'] text-[12px] text-primary-container font-bold">
                Create Team
              </span>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="font-['Press_Start_2P'] text-outline hover:text-white text-[12px]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-space-lg flex flex-col gap-space-md">
              <div className="flex flex-col gap-1">
                <label className="font-['Press_Start_2P'] text-[9px] text-on-surface-variant">TEAM NAME</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ByteCrushers"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  className="bg-surface-container-lowest border-[2px] border-black p-space-sm font-['Courier_Prime'] text-[15px] text-primary focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-['Press_Start_2P'] text-[9px] text-on-surface-variant">MAX MEMBERS</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newTeamMaxMembers}
                  onChange={e => setNewTeamMaxMembers(parseInt(e.target.value, 10) || 3)}
                  className="bg-surface-container-lowest border-[2px] border-black p-space-sm font-['Courier_Prime'] text-[15px] text-primary focus:outline-none w-28"
                />
              </div>

              <div className="flex items-center justify-end gap-space-sm mt-space-sm">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-space-md py-space-sm bg-surface-container-high border-[2px] border-black font-['Press_Start_2P'] text-[9px]"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-space-md py-space-sm bg-primary-container text-black font-['Press_Start_2P'] text-[10px] shadow-[3px_3px_0px_#000000] hover:bg-tertiary-fixed font-bold"
                >
                  CREATE TEAM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK GENERATE MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container border-[4px] border-black shadow-[8px_8px_0px_#000000] flex flex-col">
            <div className="bg-surface-container-lowest px-space-md py-space-sm border-b-[3px] border-black flex items-center justify-between">
              <span className="font-['Press_Start_2P'] text-[12px] text-tertiary-fixed font-bold">
                Bulk Generate Teams
              </span>
              <button 
                onClick={() => setIsBulkModalOpen(false)}
                className="font-['Press_Start_2P'] text-outline hover:text-white text-[12px]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="p-space-lg flex flex-col gap-space-md">
              <div className="flex flex-col gap-1">
                <label className="font-['Press_Start_2P'] text-[9px] text-on-surface-variant">NUMBER OF TEAMS</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={bulkCount}
                  onChange={e => setBulkCount(parseInt(e.target.value, 10) || 1)}
                  className="bg-surface-container-lowest border-[2px] border-black p-space-sm font-['Courier_Prime'] text-[15px] text-primary focus:outline-none w-32"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-['Press_Start_2P'] text-[9px] text-on-surface-variant">NAME PREFIX</label>
                <input
                  type="text"
                  placeholder="e.g. Team or Pod"
                  value={bulkPrefix}
                  onChange={e => setBulkPrefix(e.target.value)}
                  className="bg-surface-container-lowest border-[2px] border-black p-space-sm font-['Courier_Prime'] text-[15px] text-primary focus:outline-none"
                />
                <span className="font-['VT323'] text-[14px] text-outline mt-1">
                  Will generate: "{bulkPrefix} 01", "{bulkPrefix} 02", etc. each with unique join codes.
                </span>
              </div>

              <div className="flex items-center justify-end gap-space-sm mt-space-sm">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-space-md py-space-sm bg-surface-container-high border-[2px] border-black font-['Press_Start_2P'] text-[9px]"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="px-space-md py-space-sm bg-tertiary-fixed text-black font-['Press_Start_2P'] text-[10px] shadow-[3px_3px_0px_#000000] hover:bg-tertiary font-bold"
                >
                  GENERATE {bulkCount} TEAMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
