import React, { useEffect, useRef } from 'react';
import { useParticipant } from '../../context/ParticipantContext';
import { ParticipantHeader } from '../../components/participant/ParticipantHeader';
import { ParticipantLoginView } from './ParticipantLoginView';
import { ParticipantArenaView } from './ParticipantArenaView';
import { ParticipantStandbyView } from './ParticipantStandbyView';
import { ParticipantConfigView } from './ParticipantConfigView';
import { ParticipantLeaderboardView } from './ParticipantLeaderboardView';
import { EmergencyOverlays } from '../../components/participant/EmergencyOverlays';

export const ParticipantPortal: React.FC = () => {
  const { isAuthenticated, currentTab, setCurrentTab, contestState, leaveTeam } = useParticipant();

  const prevStatusRef = useRef<string | null>(null);
  const hasSetInitialTabRef = useRef<boolean>(false);

  // Set smart initial tab upon authentication based on current contest state
  useEffect(() => {
    if (!isAuthenticated) {
      hasSetInitialTabRef.current = false;
      return;
    }

    if (!hasSetInitialTabRef.current) {
      const isPending = contestState.status === 'not_started' || (contestState.status as string) === 'pending';
      if (isPending) {
        setCurrentTab('quest-log');
      } else if (contestState.status === 'running') {
        setCurrentTab('battle-arena');
      } else if (contestState.status === 'ended') {
        setCurrentTab('leaderboard');
      }
      hasSetInitialTabRef.current = true;
    }
  }, [isAuthenticated, contestState.status, setCurrentTab]);

  // Transition listener: when status shifts pending/not_started -> running, auto-switch to arena
  useEffect(() => {
    if (!isAuthenticated) return;

    const wasPending = prevStatusRef.current === 'not_started' || prevStatusRef.current === 'pending';
    if (wasPending && contestState.status === 'running') {
      setCurrentTab('battle-arena');
    }
    prevStatusRef.current = contestState.status;
  }, [isAuthenticated, contestState.status, setCurrentTab]);

  if (!isAuthenticated) {
    return <ParticipantLoginView />;
  }

  return (
    <div className="bg-background font-body-md text-on-surface antialiased relative min-h-screen selection:bg-primary-container selection:text-on-primary">
      {/* Background Pixel & Scanline Layers */}
      <div className="fixed inset-0 pointer-events-none pixel-dot-grid opacity-10 z-0"></div>
      <div className="fixed inset-0 pointer-events-none scanline-layer opacity-20 z-0"></div>

      {/* Participant Top Header */}
      <ParticipantHeader />

      {/* Main Dynamic Viewport */}
      <main className="w-full pt-20 bg-background relative z-10 min-h-[calc(100vh-4rem)]">
        {currentTab === 'battle-arena' && <ParticipantArenaView />}
        {currentTab === 'leaderboard' && <ParticipantLeaderboardView />}
        {currentTab === 'api-key-config' && <ParticipantConfigView />}
        {currentTab === 'quest-log' && <ParticipantStandbyView />}
      </main>

      {/* Emergency Alert Overlays */}
      <EmergencyOverlays />

      {/* Clean Footer */}
      <footer className="w-full bg-surface-container-lowest border-t-2 border-black relative z-10 py-space-sm">
        <div className="w-full px-gutter flex flex-col md:flex-row items-center justify-between gap-space-sm font-label-sm text-label-sm text-on-surface-variant font-mono">
          <div className="flex items-center gap-space-md flex-wrap">
            <span className="text-primary font-bold">Prompt Arena</span>
            <span className="text-outline-variant">•</span>
            <span className="text-tertiary-fixed font-bold">Status: Ready</span>
            <span className="text-outline-variant">•</span>
            <button
              onClick={leaveTeam}
              className="text-secondary hover:underline cursor-pointer font-bold"
              title="Leave current team and return to team login"
            >
              Leave Team
            </button>
          </div>
          <div className="flex items-center gap-space-md">
            <span className="text-on-surface">Prompt Arena © {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
