import React from 'react';
import { useArena } from '../context/ArenaContext';
import { playSound } from '../lib/audio';

export type ActiveTab = 'dashboard' | 'teams' | 'questions-bank' | 'leaderboard' | 'arena-controls' | 'system-audit-log';

interface SidebarProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { isRealtimeConnected, totalTeams, onlineCount } = useArena();

  const navItems: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'DASHBOARD', icon: 'grid_view' },
    { id: 'teams', label: 'TEAMS', icon: 'groups' },
    { id: 'questions-bank', label: 'QUESTIONS', icon: 'terminal' },
    { id: 'leaderboard', label: 'LEADERBOARD', icon: 'military_tech' },
    { id: 'arena-controls', label: 'CONTROLS', icon: 'sports_esports' },
    { id: 'system-audit-log', label: 'AUDIT LOG', icon: 'receipt_long' },
  ];

  const handleNav = (tab: ActiveTab) => {
    playSound.click();
    onSelectTab(tab);
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-lowest z-40 flex flex-col border-r-[4px] border-black shadow-[4px_0px_0px_#000000]">
      {/* Brand Header */}
      <div className="p-space-md border-b-[4px] border-black bg-surface-container-low flex flex-col gap-space-xs">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 bg-primary-container border-[2px] border-black flex items-center justify-center text-black font-['Press_Start_2P'] text-[14px] shadow-[2px_2px_0px_#000000]">
            ⚡
          </div>
          <div className="flex flex-col">
            <span className="font-['Press_Start_2P'] text-primary-container text-[12px] tracking-wider uppercase drop-shadow-[2px_2px_0px_#000000] leading-tight">
              PROMPT ARENA
            </span>
            <span className="font-['VT323'] text-on-surface-variant text-[14px]">
              SUPER ADMIN CONSOLE
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-space-xs">
          <span className="px-space-xs py-0.5 bg-surface-container-high border-[2px] border-black text-secondary font-['Space_Mono'] text-[10px] tracking-widest shadow-[2px_2px_0px_#000000]">
            CONTROL
          </span>
          <span className="flex items-center gap-1 font-['Space_Mono'] text-[10px] text-tertiary-fixed font-bold">
            <span className={`w-2 h-2 ${isRealtimeConnected ? 'bg-tertiary-fixed blink-fast' : 'bg-outline'} inline-block`}></span>
            {isRealtimeConnected ? 'LIVE REALTIME' : 'LOCAL STORE'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-space-md flex flex-col gap-space-sm overflow-y-auto">
        {navItems.map(item => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`group flex items-center justify-between px-space-md py-space-sm transition-none active:translate-x-1 active:translate-y-1 text-left ${
                isActive
                  ? 'bg-surface-container-high text-primary-container border-[3px] border-primary-container shadow-[4px_4px_0px_#000000]'
                  : 'bg-surface-container-low text-on-surface-variant border-[3px] border-black shadow-[3px_3px_0px_#000000] hover:bg-surface-container hover:text-primary'
              }`}
              data-active={isActive ? 'true' : undefined}
            >
              <div className="flex items-center gap-space-sm">
                <span className={`material-symbols-outlined text-[20px] ${
                  isActive ? 'text-primary-container' : 'text-on-surface-variant group-hover:text-primary'
                }`}>
                  {item.icon}
                </span>
                <span className="font-['Press_Start_2P'] text-[11px] tracking-wider">
                  {item.label}
                </span>
              </div>
              <span className={`pixel-cursor font-bold text-[14px] ${
                isActive ? 'text-primary-container inline-block' : 'text-primary-container'
              }`}>
                &gt;
              </span>
            </button>
          );
        })}
      </nav>

      {/* Real Server Status Footer */}
      <div className="p-space-md border-t-[4px] border-black bg-surface-container-low">
        <div className="bg-surface-container-lowest border-[2px] border-black p-space-sm shadow-[inset_2px_2px_0px_#000000]">
          <div className="flex items-center justify-between font-['VT323'] text-[16px] text-on-surface-variant">
            <span className="text-tertiary-fixed flex items-center gap-1 font-bold">
              <span className="w-1.5 h-1.5 bg-tertiary-fixed inline-block"></span>
              ROSTER: {totalTeams} TEAMS
            </span>
            <span className="text-primary-container">[{onlineCount} ONLINE]</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
