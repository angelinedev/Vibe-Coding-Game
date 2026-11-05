import React, { useState, useEffect, useCallback } from 'react';
import { useArena } from '../context/ArenaContext';
import { supabase } from '../lib/supabase';

interface HeaderProps {
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const { contestState, onlineCount, totalTeams, isSFXMuted, toggleSFXMute } = useArena();
  const [timeLeft, setTimeLeft] = useState('00:00:00');
  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline' | 'checking'>('checking');
  const [backendError, setBackendError] = useState<string | null>(null);

  const checkBackendHealth = useCallback(async () => {
    try {
      const { error } = await supabase.from('contest_state').select('id').limit(1).single();
      if (error) {
        setBackendStatus('offline');
        setBackendError(error.message || 'Database query failed');
      } else {
        setBackendStatus('connected');
        setBackendError(null);
      }
    } catch (err: any) {
      setBackendStatus('offline');
      setBackendError(err?.message || 'Network request failed (backend unreachable or project paused)');
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 20000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

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

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const fmt = (n: number) => n.toString().padStart(2, '0');
      setTimeLeft(`${fmt(hours)}:${fmt(minutes)}:${fmt(seconds)}`);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [contestState.ends_at, contestState.status, contestState.paused_remaining_seconds]);

  return (
    <>
      <header className="fixed top-0 left-72 right-0 h-16 bg-surface-container-lowest border-b-[4px] border-black z-30 flex items-center justify-between px-gutter shadow-[0_4px_0px_#000000]">
        {/* Left: Contest Status Badge & Connection Indicator */}
        <div className="flex items-center gap-space-md">
          {/* Connection Status Indicator */}
          <div 
            id="admin-connection-indicator"
            className={`flex items-center gap-2 px-space-sm py-1 border-[3px] border-black shadow-[3px_3px_0px_#000000] font-['Press_Start_2P'] text-[9px] cursor-help ${
              backendStatus === 'connected'
                ? 'bg-surface-container-lowest text-tertiary-fixed'
                : backendStatus === 'checking'
                ? 'bg-surface-container text-on-surface'
                : 'bg-error-container text-white animate-pulse'
            }`}
            title={backendStatus === 'connected' ? 'Backend connected & responding to queries' : backendError || 'Backend unreachable'}
          >
            <span className={`w-2.5 h-2.5 ${
              backendStatus === 'connected'
                ? 'bg-tertiary-fixed blink-fast'
                : backendStatus === 'checking'
                ? 'bg-secondary'
                : 'bg-red-500'
            } border border-black`}></span>
            <span>
              {backendStatus === 'connected' ? 'CONNECTED' : backendStatus === 'checking' ? 'CHECKING...' : 'OFFLINE'}
            </span>
          </div>

          <div className="flex items-center gap-2 px-space-sm py-1 bg-surface-container-lowest border-[3px] border-black shadow-[3px_3px_0px_#000000]">
            <span className={`w-2.5 h-2.5 ${
              contestState.status === 'running' 
                ? 'bg-tertiary-fixed blink-fast' 
                : contestState.status === 'paused' 
                ? 'bg-secondary blink-fast' 
                : 'bg-outline'
            } border border-black`}></span>
            <span className={`font-['Press_Start_2P'] text-[11px] uppercase ${
              contestState.status === 'running' ? 'text-tertiary-fixed' : 'text-on-surface'
            }`}>
              {contestState.status.replace('_', ' ')}
            </span>
          </div>
          {contestState.leaderboard_frozen && (
            <span className="px-space-xs py-0.5 bg-error-container text-white border-[2px] border-black font-['Press_Start_2P'] text-[9px] shadow-[2px_2px_0px_#000000]">
              BOARD FROZEN
            </span>
          )}
        </div>

      {/* Center: Match Clock */}
      <div className="flex flex-col items-center justify-center">
        <div className="font-['Press_Start_2P'] text-primary-container text-[14px] tracking-widest leading-tight drop-shadow-[2px_2px_0px_#000000]">
          {timeLeft}
        </div>
        <span className="font-['VT323'] text-secondary text-[15px] uppercase tracking-wider">
          {contestState.status === 'running' ? 'Match Time Remaining' : 'Contest Clock'}
        </span>
      </div>

      {/* Right: Real Teams Online Count & Admin Status */}
      <div className="flex items-center gap-space-md">
        <div className="hidden md:flex items-center gap-2 px-space-sm py-1 bg-surface-container-low border-[2px] border-black shadow-[2px_2px_0px_#000000]">
          <span className="w-2 h-2 bg-tertiary-fixed blink-fast"></span>
          <span className="font-['VT323'] text-on-surface text-[17px]">
            Active Teams: <strong className="text-primary-container">{onlineCount} / {totalTeams}</strong>
          </span>
        </div>

        <button 
          onClick={toggleSFXMute}
          className="px-space-sm py-1 bg-surface-container text-on-surface-variant hover:text-on-surface border-[2px] border-black uppercase shadow-[2px_2px_0px_#000000] active:translate-y-0.5 font-['Press_Start_2P'] text-[9px]"
        >
          {isSFXMuted ? 'Sound: Off' : 'Sound: On'}
        </button>

        {/* Admin Logout Button */}
        <button
          onClick={onLogout}
          id="admin-logout-btn"
          className="px-space-sm py-1 bg-error-container text-white hover:bg-error border-[2px] border-black uppercase shadow-[2px_2px_0px_#000000] active:translate-y-0.5 font-['Press_Start_2P'] text-[9px] font-bold flex items-center gap-1 cursor-pointer"
          title="Sign out of Super Admin"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>

        <div className="flex items-center gap-space-sm pl-space-sm border-l-[3px] border-black">
          <div className="flex flex-col text-right">
            <span className="font-['Press_Start_2P'] text-[9px] text-secondary leading-tight">
              SUPER ADMIN
            </span>
            <span className="font-['VT323'] text-on-surface-variant text-[14px]">
              AUTHENTICATED
            </span>
          </div>
          <div className="w-8 h-8 rounded-none border-[2px] border-black bg-surface-container-high flex items-center justify-center shadow-[2px_2px_0px_#000000] text-primary-container font-['Press_Start_2P'] text-[12px]">
            👾
          </div>
        </div>
      </div>
    </header>

    {/* Backend Offline / Project Paused Alert Banner */}
    {backendStatus === 'offline' && (
      <div 
        id="backend-error-banner"
        className="fixed top-16 left-72 right-0 bg-red-600 text-black border-b-[4px] border-black px-6 py-2.5 z-40 flex items-center justify-between shadow-[0_4px_0px_#000000] animate-pulse"
      >
        <div className="flex items-center gap-3">
          <span className="font-['Press_Start_2P'] text-[14px]">⚠️</span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="font-['Press_Start_2P'] text-[10px] uppercase font-bold text-black">
              [ BACKEND OFFLINE / UNREACHABLE ]
            </span>
            <span className="font-mono text-xs font-bold text-neutral-900 truncate max-w-xl">
              {backendError || 'Supabase is unreachable (project paused, invalid credentials, or connection lost)'}
            </span>
          </div>
        </div>
        <button
          id="retry-health-check-button"
          onClick={checkBackendHealth}
          className="px-3 py-1 bg-black text-white hover:bg-neutral-800 font-['Press_Start_2P'] text-[9px] uppercase border border-black shadow-[2px_2px_0px_#ffffff] active:translate-y-0.5 cursor-pointer whitespace-nowrap"
        >
          [ RETRY ]
        </button>
      </div>
    )}
  </>
  );
};
