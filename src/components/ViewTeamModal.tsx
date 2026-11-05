import React from 'react';
import { useArena } from '../context/ArenaContext';

export const ViewTeamModal: React.FC = () => {
  const { selectedTeam, setSelectedTeam, disqualifyTeam, toggleJoinLock, regenerateJoinCode } = useArena();

  if (!selectedTeam) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-xl bg-surface-container border-[4px] border-primary-container shadow-[8px_8px_0px_#000000] p-0 flex flex-col">
        {/* Title Bar */}
        <div className="bg-primary-container px-space-md py-space-sm border-b-[4px] border-black flex items-center justify-between text-black font-bold">
          <div className="flex items-center gap-2 font-['Press_Start_2P'] text-[11px]">
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            <span>Team Details: {selectedTeam.name}</span>
          </div>
          <button 
            onClick={() => setSelectedTeam(null)}
            className="px-2 py-0.5 bg-black text-primary-container font-['Press_Start_2P'] text-[10px] border border-black hover:bg-error hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-space-lg flex flex-col gap-space-md font-['VT323'] text-[18px]">
          <div className="flex items-center justify-between bg-surface-container-lowest p-space-sm border-[2px] border-black">
            <div className="flex flex-col">
              <span className="font-['Press_Start_2P'] text-[14px] text-primary-container font-bold">
                {selectedTeam.name}
              </span>
              <span className="text-tertiary-fixed text-[18px] font-mono mt-1">
                JOIN CODE: {selectedTeam.join_code}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-1 font-['Press_Start_2P'] text-[9px] border border-black font-bold ${
                selectedTeam.status === 'disqualified'
                  ? 'bg-error text-black'
                  : 'bg-tertiary-fixed text-black'
              }`}>
                {selectedTeam.status.toUpperCase()}
              </span>
              {selectedTeam.join_locked && (
                <span className="px-2 py-1 font-['Press_Start_2P'] text-[9px] border border-black bg-secondary text-black font-bold">
                  LOCKED
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-space-sm">
            <div className="bg-surface-container-lowest p-space-sm border border-black">
              <span className="text-on-surface-variant text-[14px]">BEST SCORE</span>
              <div className="text-[28px] text-secondary font-bold">
                {selectedTeam.best_score.toLocaleString()} PTS
              </div>
            </div>
            <div className="bg-surface-container-lowest p-space-sm border border-black">
              <span className="text-on-surface-variant text-[14px]">TAB SWITCHES</span>
              <div className={`text-[28px] font-bold ${
                selectedTeam.tab_switch_count >= 3 ? 'text-error' : 'text-tertiary-fixed'
              }`}>
                {selectedTeam.tab_switch_count} FLAGS
              </div>
            </div>
            <div className="bg-surface-container-lowest p-space-sm border border-black">
              <span className="text-on-surface-variant text-[14px]">ROSTER SIZE</span>
              <div className="text-[28px] text-primary-container font-bold">
                {selectedTeam.members?.length || 0} / {selectedTeam.max_members}
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-surface-container-lowest p-space-sm border border-black flex flex-col gap-1">
            <span className="font-['Press_Start_2P'] text-[9px] text-on-surface-variant uppercase">
              REGISTERED MEMBERS
            </span>
            {(!selectedTeam.members || selectedTeam.members.length === 0) ? (
              <span className="text-outline italic text-[16px] py-1">
                No contestants have joined with this code yet.
              </span>
            ) : (
              <div className="flex flex-col gap-1 mt-1">
                {selectedTeam.members.map(m => (
                  <div key={m.id} className="flex justify-between items-center text-[15px] font-['Courier_Prime'] border-b border-black/30 pb-0.5">
                    <span className="text-on-surface font-bold">👤 {m.display_name}</span>
                    <span className="text-on-surface-variant font-['VT323'] text-[16px]">
                      {m.tab_switch_count} tab switches | Joined: {new Date(m.joined_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin Command Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-space-sm pt-space-xs border-t-[2px] border-black">
            <button
              onClick={() => {
                toggleJoinLock(selectedTeam.id);
                setSelectedTeam(null);
              }}
              className="px-space-md py-space-sm bg-surface-container-high border-[2px] border-black text-on-surface font-['Press_Start_2P'] text-[9px] hover:bg-surface-bright"
            >
              {selectedTeam.join_locked ? 'Unlock Join Code' : 'Lock Join Code'}
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Regenerate join code for ${selectedTeam.name}?`)) {
                  regenerateJoinCode(selectedTeam.id);
                  setSelectedTeam(null);
                }
              }}
              className="px-space-md py-space-sm bg-surface-container-high border-[2px] border-black text-outline hover:text-white font-['Press_Start_2P'] text-[9px]"
            >
              Regenerate Code
            </button>

            {selectedTeam.status !== 'disqualified' && (
              <button
                onClick={() => {
                  if (window.confirm(`Disqualify team "${selectedTeam.name}"?`)) {
                    disqualifyTeam(selectedTeam.id);
                    setSelectedTeam(null);
                  }
                }}
                className="px-space-md py-space-sm bg-error-container text-white border-[2px] border-black font-['Press_Start_2P'] text-[9px] hover:bg-error hover:text-black font-bold"
              >
                Disqualify Team
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
