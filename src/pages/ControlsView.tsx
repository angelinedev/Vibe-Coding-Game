import React, { useState, useEffect } from 'react';
import { useArena } from '../context/ArenaContext';
import { playSound } from '../lib/audio';

export const ControlsView: React.FC = () => {
  const { 
    contestState, 
    startContest,
    pauseContest, 
    resumeContest, 
    endContest, 
    addOvertime, 
    sendBroadcast 
  } = useArena();

  const [broadcastInput, setBroadcastInput] = useState('');
  const [startDurationInput, setStartDurationInput] = useState(90);
  const [lastActionMsg, setLastActionMsg] = useState('ARENA CONTROLS INITIALIZED.');
  const [timeLeft, setTimeLeft] = useState('00:00:00');

  // Real Timer Countdown
  useEffect(() => {
    const updateTime = () => {
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

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [contestState.ends_at, contestState.status, contestState.paused_remaining_seconds]);

  const handlePreset = (text: string, prio: 'normal' | 'flash' | 'alert' = 'normal') => {
    sendBroadcast(text, prio);
    setLastActionMsg(`FLASH BROADCAST SENT: "${text}" @ ${new Date().toLocaleTimeString()}`);
  };

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastInput.trim()) return;
    sendBroadcast(broadcastInput.trim(), 'normal');
    setLastActionMsg(`BROADCAST SENT TO ALL TEAMS: "${broadcastInput}" @ ${new Date().toLocaleTimeString()}`);
    setBroadcastInput('');
  };

  return (
    <div className="flex flex-col w-full p-gutter gap-space-lg text-on-surface">
      {/* Top Hub Banner */}
      <div className="bg-surface-container-low p-space-md shadow-[4px_4px_0px_#000000] flex flex-col md:flex-row justify-between items-start md:items-center gap-space-sm border border-black/50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs flex-wrap">
            <span className="px-space-xs py-0.5 bg-primary-container text-black font-['Press_Start_2P'] text-[10px] tracking-wider uppercase font-bold">
              CMD_HUB
            </span>
            <h1 className="font-['Press_Start_2P'] text-primary text-[13px] tracking-wider uppercase drop-shadow-[2px_2px_0px_#000000]">
              Match Clock & Broadcast Operations
            </h1>
          </div>
          <p className="font-['VT323'] text-on-surface-variant text-[17px] tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 bg-tertiary-fixed blink-fast inline-block"></span>
            Super Admin Controls
          </p>
        </div>

        <div className="flex items-center gap-space-sm self-end md:self-auto">
          <div className="bg-surface-container-lowest px-space-md py-space-xs shadow-[inset_2px_2px_0px_#000000] border border-black flex items-center gap-2">
            <span className="font-['VT323'] text-secondary text-[16px]">STATUS:</span>
            <span className="font-['Press_Start_2P'] text-[11px] text-tertiary-fixed uppercase">
              {contestState.status}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* MATCH CLOCK & TIMER PANEL (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col gap-space-lg">
          <div className="bg-surface-container shadow-[4px_4px_0px_#000000] flex flex-col border border-black">
            <div className="bg-surface-container-lowest px-space-md py-space-xs flex items-center justify-between border-b-[2px] border-black">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-primary-container text-[18px]">timer</span>
                <span className="font-['Press_Start_2P'] text-primary-container text-[11px] tracking-wider uppercase font-bold">
                  MATCH CLOCK &amp; TIMING CONTROLS
                </span>
              </div>
              <span className="font-['VT323'] text-[16px] text-tertiary-fixed font-bold">
                Live Clock
              </span>
            </div>

            <div className="p-space-lg flex flex-col gap-space-lg bg-surface-container-high/40">
              <div className="flex flex-col items-center justify-center gap-space-md bg-surface-container-lowest p-space-lg shadow-[inset_4px_4px_0px_#000000] border border-black text-center">
                <span className="font-['VT323'] text-on-surface-variant text-[18px] uppercase tracking-widest flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 ${
                    contestState.status === 'running' ? 'bg-tertiary-fixed blink-fast' : 'bg-secondary'
                  } inline-block`}></span>
                  CONTEST COUNTDOWN TIMER
                </span>

                <div className="font-['Press_Start_2P'] text-[36px] sm:text-[48px] text-primary tracking-widest drop-shadow-[4px_4px_0px_#000000] select-all">
                  {timeLeft}
                </div>

                <div className="flex items-center gap-2 font-['VT323'] text-[18px] text-tertiary-fixed">
                  <span>PHASE: <strong className="uppercase">{contestState.status.replace('_', ' ')}</strong></span>
                  {contestState.ends_at && (
                    <>
                      <span className="text-outline">::</span>
                      <span className="text-on-surface-variant">
                        ENDS AT: {new Date(contestState.ends_at).toLocaleTimeString()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                {contestState.status === 'not_started' || contestState.status === 'ended' ? (
                  <button 
                    onClick={() => {
                      startContest(startDurationInput);
                      setLastActionMsg(`CONTEST STARTED WITH ${startDurationInput} MINUTES`);
                    }}
                    className="px-space-md py-space-sm bg-tertiary-fixed text-black font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-tertiary active:translate-x-1 active:translate-y-1 flex items-center justify-center gap-2 font-bold col-span-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    START ({startDurationInput}m)
                  </button>
                ) : contestState.status === 'paused' ? (
                  <button 
                    onClick={() => {
                      resumeContest();
                      setLastActionMsg('CONTEST RESUMED');
                    }}
                    className="px-space-md py-space-sm bg-tertiary-fixed text-black font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-tertiary active:translate-x-1 active:translate-y-1 flex items-center justify-center gap-2 font-bold"
                  >
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                    RESUME
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      pauseContest();
                      setLastActionMsg('CONTEST PAUSED');
                    }}
                    className="px-space-md py-space-sm bg-surface-variant text-secondary font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-secondary hover:text-black active:translate-x-1 active:translate-y-1 flex items-center justify-center gap-2 font-bold"
                  >
                    <span className="material-symbols-outlined text-[16px]">pause</span>
                    PAUSE
                  </button>
                )}

                <button 
                  onClick={() => {
                    addOvertime(5);
                    setLastActionMsg('OVERTIME +5:00 ADDED TO CLOCK');
                  }}
                  className="px-space-md py-space-sm bg-primary-container text-black font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-primary-fixed active:translate-x-1 active:translate-y-1 flex items-center justify-center gap-2 font-bold"
                >
                  <span className="material-symbols-outlined text-[16px]">update</span>
                  +5M OVERTIME
                </button>

                <button 
                  onClick={() => {
                    if (window.confirm('Terminate contest match immediately?')) {
                      endContest();
                      setLastActionMsg('CONTEST TERMINATED BY ADMIN');
                    }
                  }}
                  className="px-space-md py-space-sm bg-error-container text-white font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-error hover:text-black active:translate-x-1 active:translate-y-1 flex items-center justify-center gap-2 font-bold"
                >
                  <span className="material-symbols-outlined text-[16px]">stop</span>
                  END CONTEST
                </button>

                {contestState.status === 'not_started' && (
                  <div className="flex items-center gap-1 col-span-2">
                    <span className="font-['VT323'] text-[16px] text-on-surface-variant">DURATION (MINUTES):</span>
                    <input 
                      type="number"
                      min="1"
                      max="300"
                      value={startDurationInput}
                      onChange={e => setStartDurationInput(parseInt(e.target.value, 10) || 90)}
                      className="bg-surface-container-lowest border border-black p-1 text-primary font-['Press_Start_2P'] text-[10px] w-24 text-center"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BROADCAST COMMUNICATOR (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col gap-space-lg">
          <div className="bg-surface-container shadow-[4px_4px_0px_#000000] flex flex-col border border-black">
            <div className="bg-surface-container-lowest px-space-md py-space-xs flex items-center justify-between border-b-[2px] border-black">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-secondary text-[18px]">campaign</span>
                <span className="font-['Press_Start_2P'] text-secondary text-[11px] tracking-wider uppercase font-bold">
                  BROADCAST COMMUNICATOR
                </span>
              </div>
              <span className="font-['VT323'] text-[16px] text-tertiary-fixed font-bold">
                Live Dispatch
              </span>
            </div>

            <div className="p-space-lg flex flex-col gap-space-md bg-surface-container-low">
              {/* Presets */}
              <div className="flex flex-col gap-space-xs">
                <span className="font-['Press_Start_2P'] text-[9px] text-on-surface-variant uppercase">
                  Quick Flash Notices
                </span>
                <div className="flex flex-col gap-space-xs">
                  <button 
                    onClick={() => handlePreset('⚡ ATTENTION: 10 MINUTES REMAINING IN THE CONTEST!', 'flash')}
                    className="p-space-sm bg-surface-container-lowest text-primary font-['Press_Start_2P'] text-[9px] shadow-[2px_2px_0px_#000000] hover:bg-surface-variant text-left border border-black active:translate-y-0.5"
                  >
                    ⚡ 10 Min Remaining Flash
                  </button>

                  <button 
                    onClick={() => handlePreset('⚠ ATTENTION: TAB-SWITCH LIMIT ENFORCEMENT ACTIVE', 'alert')}
                    className="p-space-sm bg-surface-container-lowest text-secondary font-['Press_Start_2P'] text-[9px] shadow-[2px_2px_0px_#000000] hover:bg-surface-variant text-left border border-black active:translate-y-0.5"
                  >
                    ⚠ Tab-Out Warning
                  </button>

                  <button 
                    onClick={() => handlePreset('🎁 BONUS QUESTION HAS BEEN UNLOCKED IN THE ARENA!', 'flash')}
                    className="p-space-sm bg-surface-container-lowest text-tertiary-fixed font-['Press_Start_2P'] text-[9px] shadow-[2px_2px_0px_#000000] hover:bg-surface-variant text-left border border-black active:translate-y-0.5"
                  >
                    🎁 Bonus Question Unlocked
                  </button>
                </div>
              </div>

              {/* Custom Broadcast */}
              <form onSubmit={handleCustomSend} className="flex flex-col gap-space-xs mt-space-sm">
                <span className="font-['Press_Start_2P'] text-[9px] text-on-surface-variant uppercase">
                  CUSTOM MESSAGE TO ALL TEAMS
                </span>
                <div className="flex flex-col gap-space-sm">
                  <input 
                    type="text"
                    required
                    maxLength={140}
                    value={broadcastInput}
                    onChange={e => setBroadcastInput(e.target.value)}
                    placeholder="TYPE SYSTEM BROADCAST (MAX 140 CHARS)..."
                    className="bg-surface-container-lowest border-[2px] border-black p-space-sm text-primary font-['Courier_Prime'] text-[15px] focus:outline-none placeholder:text-outline uppercase"
                  />
                  <button 
                    type="submit"
                    className="w-full py-space-sm bg-secondary-container text-on-secondary-container font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-secondary hover:text-black transition-none active:translate-y-0.5 flex items-center justify-center gap-2 font-bold"
                  >
                    <span className="material-symbols-outlined text-[16px]">send</span>
                    SEND TO ALL PARTICIPANTS
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Status Bar */}
      <div className="bg-surface-container-lowest p-space-sm shadow-[3px_3px_0px_#000000] border border-black flex items-center justify-between font-['VT323'] text-[17px] text-on-surface-variant">
        <div className="flex items-center gap-space-sm">
          <span className="text-tertiary-fixed flex items-center gap-1 font-bold">
            <span className="w-2 h-2 bg-tertiary-fixed inline-block"></span>
            OPERATIONS STATUS: ONLINE
          </span>
          <span>|</span>
          <span>{lastActionMsg}</span>
        </div>
        <div className="text-primary-container hidden md:inline font-bold">
          [PROMPT ARENA v1.0.4]
        </div>
      </div>
    </div>
  );
};
