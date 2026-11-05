import React, { useState, useEffect } from 'react';
import { useArena } from '../context/ArenaContext';

export const MarqueeTicker: React.FC = () => {
  const { auditLogs } = useArena();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (auditLogs.length <= 1) return;
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % auditLogs.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [auditLogs.length]);

  const currentLog = auditLogs[index] || {
    message: "[14:42:01] PROCTOR_AI: Proctor telemetry stream healthy and synchronized.",
    severity: 'info'
  };

  return (
    <div className="px-space-lg pb-space-lg pt-space-xs">
      <div className="bg-surface-container-lowest p-space-sm shadow-[4px_4px_0px_#000000] flex flex-col md:flex-row items-center justify-between gap-space-sm border border-black/50">
        <div className="flex items-center gap-space-sm overflow-hidden w-full md:w-auto">
          <span className="px-space-xs py-0.5 bg-surface-container-high text-secondary font-['Press_Start_2P'] text-[8px] uppercase shadow-[2px_2px_0px_#000000]">
            SYS_LOG
          </span>
          <div className="font-['VT323'] text-[17px] text-tertiary-fixed truncate">
            {currentLog.message}
          </div>
        </div>
        <div className="font-['Press_Start_2P'] text-[8px] text-outline whitespace-nowrap self-end md:self-auto">
          MEM: 45 MB • CPU: 3% • BUFFER: 100%
        </div>
      </div>
    </div>
  );
};
