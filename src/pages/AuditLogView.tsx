import React, { useState, useMemo } from 'react';
import { useArena } from '../context/ArenaContext';
import { playSound } from '../lib/audio';

export const AuditLogView: React.FC = () => {
  const { auditLogs } = useArena();
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (filterSeverity !== 'all' && log.severity !== filterSeverity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return log.message.toLowerCase().includes(q) || 
          (log.team_name && log.team_name.toLowerCase().includes(q)) ||
          log.event_type.toLowerCase().includes(q);
      }
      return true;
    });
  }, [auditLogs, filterSeverity, searchQuery]);

  return (
    <div className="flex flex-col w-full p-gutter gap-space-lg text-on-surface">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest p-space-md shadow-[4px_4px_0px_#000000] flex flex-col md:flex-row md:items-center justify-between gap-space-md border border-black">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs">
            <span className="w-3 h-3 bg-secondary inline-block"></span>
            <h1 className="font-['Press_Start_2P'] text-[16px] text-secondary tracking-wider uppercase">
              SYSTEM &amp; PROCTOR AUDIT TELEMETRY LOG
            </h1>
          </div>
          <div className="font-['VT323'] text-[18px] text-on-surface-variant flex items-center gap-2">
            <span className="text-tertiary-fixed flex items-center gap-1 font-bold">
              <span className="w-2 h-2 bg-tertiary-fixed blink-fast inline-block"></span>
              STREAMING ACTIVE (REALTIME CDC)
            </span>
            <span className="text-outline">::</span>
            <span>TOTAL RECORDED EVENTS: <strong className="text-primary-container">{auditLogs.length}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-space-sm">
          <button 
            onClick={() => playSound.click()}
            className="px-space-md py-space-sm bg-surface-container-high border-[2px] border-black font-['Press_Start_2P'] text-[9px] hover:bg-surface-bright flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            [EXPORT AUDIT DUMP]
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-low p-space-sm shadow-[4px_4px_0px_#000000] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-space-sm border border-black">
        <div className="flex flex-wrap items-center gap-1.5 font-['Press_Start_2P'] text-[9px]">
          <button
            onClick={() => setFilterSeverity('all')}
            className={`px-space-sm py-1.5 border-[2px] border-black ${
              filterSeverity === 'all' ? 'bg-primary-container text-black font-bold' : 'bg-surface-container-lowest text-on-surface'
            }`}
          >
            ALL EVENTS ({auditLogs.length})
          </button>
          <button
            onClick={() => setFilterSeverity('info')}
            className={`px-space-sm py-1.5 border-[2px] border-black text-tertiary-fixed ${
              filterSeverity === 'info' ? 'bg-tertiary-fixed text-black font-bold' : 'bg-surface-container-lowest'
            }`}
          >
            INFO ({auditLogs.filter(l => l.severity === 'info').length})
          </button>
          <button
            onClick={() => setFilterSeverity('warning')}
            className={`px-space-sm py-1.5 border-[2px] border-black text-secondary ${
              filterSeverity === 'warning' ? 'bg-secondary text-black font-bold' : 'bg-surface-container-lowest'
            }`}
          >
            WARNINGS ({auditLogs.filter(l => l.severity === 'warning').length})
          </button>
          <button
            onClick={() => setFilterSeverity('critical')}
            className={`px-space-sm py-1.5 border-[2px] border-black text-error ${
              filterSeverity === 'critical' ? 'bg-error text-white font-bold' : 'bg-surface-container-lowest'
            }`}
          >
            CRITICAL ({auditLogs.filter(l => l.severity === 'critical').length})
          </button>
        </div>

        <div className="flex items-center gap-2 bg-surface-container-lowest border-[2px] border-black px-space-sm py-1">
          <span className="font-['Press_Start_2P'] text-primary-container text-[10px]">&gt;</span>
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="SEARCH LOGS OR TEAMS..."
            className="bg-transparent text-primary font-['Courier_Prime'] text-[14px] focus:outline-none uppercase"
          />
        </div>
      </div>

      {/* Log Feed List */}
      <div className="bg-surface-container shadow-[6px_6px_0px_#000000] border-[4px] border-black flex flex-col">
        <div className="bg-surface-container-lowest px-space-md py-space-xs border-b-[3px] border-black flex items-center justify-between font-['Press_Start_2P'] text-[10px] text-on-surface-variant">
          <span>EVENT STREAM RECORD</span>
          <span>TIMESTAMP (UTC)</span>
        </div>

        <div className="divide-y-[2px] divide-black font-['VT323'] text-[18px]">
          {filteredLogs.length === 0 ? (
            <div className="p-space-xl flex flex-col items-center justify-center text-center gap-space-sm text-outline">
              <span className="text-[36px]">📜</span>
              <span className="font-['Press_Start_2P'] text-[12px] text-primary-container">
                NO AUDIT LOGS RECORDED YET
              </span>
              <span className="font-['Courier_Prime'] text-[14px] text-on-surface-variant max-w-sm">
                System, contest lifecycle, and proctor events will appear here in real-time as participants interact with the arena.
              </span>
            </div>
          ) : (
            filteredLogs.map(log => {
            const isCritical = log.severity === 'critical';
            const isWarn = log.severity === 'warning';

            return (
              <div 
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`p-space-sm flex flex-col md:flex-row md:items-center justify-between gap-space-sm hover:bg-surface-container-high cursor-pointer transition-none ${
                  isCritical ? 'bg-[#2A0E2A]' : isWarn ? 'bg-[#251646]' : 'bg-surface-container'
                }`}
              >
                <div className="flex items-center gap-space-sm">
                  <span className={`px-2 py-0.5 font-['Press_Start_2P'] text-[8px] border border-black shadow-[2px_2px_0px_#000000] uppercase font-bold ${
                    isCritical 
                      ? 'bg-error text-black' 
                      : isWarn 
                      ? 'bg-secondary text-black' 
                      : 'bg-surface-container-highest text-tertiary-fixed'
                  }`}>
                    {log.severity}
                  </span>

                  <span className="font-['Space_Mono'] text-[12px] text-primary-container font-bold uppercase">
                    [{log.event_type}]
                  </span>

                  <span className={`text-[19px] ${
                    isCritical ? 'text-error font-bold' : isWarn ? 'text-secondary' : 'text-on-surface'
                  }`}>
                    {log.message}
                  </span>
                </div>

                <div className="font-['VT323'] text-[16px] text-on-surface-variant whitespace-nowrap self-end md:self-auto">
                  {new Date(log.created_at).toLocaleTimeString()}
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* Detail Modal if row selected */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg bg-surface-container border-[4px] border-primary-container shadow-[8px_8px_0px_#000000] p-0 flex flex-col">
            <div className="bg-primary-container p-space-sm text-black font-['Press_Start_2P'] text-[11px] flex justify-between items-center font-bold">
              <span>AUDIT TELEMETRY INSPECTOR</span>
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-2 py-0.5 bg-black text-white hover:bg-error"
              >
                [X]
              </button>
            </div>
            <div className="p-space-lg flex flex-col gap-space-sm font-['VT323'] text-[18px]">
              <div>
                <span className="text-on-surface-variant">EVENT MESSAGE:</span>
                <p className="text-primary-container text-[20px] font-bold mt-1">
                  {selectedLog.message}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-space-sm bg-surface-container-lowest p-space-sm border border-black">
                <div>
                  <span className="text-on-surface-variant">SEVERITY:</span>
                  <div className="text-secondary font-bold uppercase">{selectedLog.severity}</div>
                </div>
                <div>
                  <span className="text-on-surface-variant">EVENT TYPE:</span>
                  <div className="text-tertiary-fixed font-bold uppercase">{selectedLog.event_type}</div>
                </div>
              </div>
              <div>
                <span className="text-on-surface-variant">RAW METADATA PAYLOAD:</span>
                <pre className="bg-surface-container-lowest p-space-sm text-[14px] text-tertiary-fixed font-mono border border-black mt-1 overflow-x-auto">
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
