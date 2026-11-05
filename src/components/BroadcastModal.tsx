import React, { useState } from 'react';
import { useArena } from '../context/ArenaContext';

interface BroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({ isOpen, onClose }) => {
  const { sendBroadcast } = useArena();
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'flash' | 'alert'>('normal');

  if (!isOpen) return null;

  const presets = [
    { title: '⚡ 10 MIN REMAINING', text: 'WARNING: 10 MINUTES REMAINING IN CURRENT ROUND!', prio: 'flash' as const },
    { title: '☠ CHEAT AUDIT IN PROCESS', text: 'AUDIT ACTIVE: CHEAT HEURISTICS SCANNING TEAMS', prio: 'alert' as const },
    { title: '🎁 BONUS Q UNLOCKED', text: 'SURPRISE REVEAL: BONUS QUESTION UNLOCKED IN PODS', prio: 'flash' as const },
    { title: '⚙ LOAD BALANCING REFRESH', text: 'ATTENTION ARENA: SERVER LOAD BALANCING COMPLETED. CONTINUE CODING.', prio: 'normal' as const },
  ];

  const handleSend = async (text: string, prio: 'normal' | 'flash' | 'alert') => {
    if (!text.trim()) return;
    await sendBroadcast(text.trim(), prio);
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-xl bg-surface-container border-[4px] border-secondary-container shadow-[8px_8px_0px_#000000] p-0 flex flex-col">
        {/* Title Bar */}
        <div className="bg-secondary-container px-space-md py-space-sm border-b-[4px] border-black flex items-center justify-between text-on-secondary-container">
          <div className="flex items-center gap-2 font-['Press_Start_2P'] text-[11px]">
            <span className="material-symbols-outlined text-[18px]">campaign</span>
            <span>Broadcast Announcement</span>
          </div>
          <button 
            onClick={onClose}
            className="px-2 py-0.5 bg-black text-white font-['Press_Start_2P'] text-[10px] border border-black hover:bg-error"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="p-space-lg flex flex-col gap-space-md">
          {/* Preset Buttons */}
          <div className="flex flex-col gap-1">
            <span className="font-['Press_Start_2P'] text-[9px] text-on-surface-variant">
              ONE-TAP PRESET ANNOUNCEMENTS:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(p.text, p.prio)}
                  className="p-space-sm bg-surface-container-lowest border-[2px] border-black shadow-[2px_2px_0px_#000000] text-left hover:bg-surface-variant flex flex-col gap-1 active:translate-y-0.5"
                >
                  <span className="font-['Press_Start_2P'] text-[9px] text-primary-container">
                    {p.title}
                  </span>
                  <span className="font-['VT323'] text-[15px] text-on-surface-variant truncate">
                    {p.text}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Message */}
          <div className="flex flex-col gap-1">
            <span className="font-['Press_Start_2P'] text-[9px] text-primary-container">
              CUSTOM MARQUEE MESSAGE:
            </span>
            <div className="bg-surface-container-lowest border-[2px] border-black p-space-sm flex items-center gap-2">
              <span className="font-['Press_Start_2P'] text-primary-container text-[12px]">&gt;</span>
              <input 
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="TYPE BROADCAST MESSAGE (MAX 120 CHARACTERS)..."
                maxLength={120}
                className="w-full bg-transparent text-primary font-['VT323'] text-[20px] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-['Press_Start_2P'] text-[9px]">
              <span className="text-on-surface-variant">PRIORITY:</span>
              <select 
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="bg-surface-container-lowest border border-black p-1 text-secondary"
              >
                <option value="normal">NORMAL</option>
                <option value="flash">FLASH (BLINK)</option>
                <option value="alert">ALERT (RED)</option>
              </select>
            </div>
            <button
              onClick={() => handleSend(message, priority)}
              className="px-space-md py-space-sm bg-secondary-container text-on-secondary-container font-['Press_Start_2P'] text-[10px] uppercase shadow-[3px_3px_0px_#000000] hover:bg-secondary hover:text-black active:translate-x-0.5 active:translate-y-0.5"
            >
              Send Broadcast
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
