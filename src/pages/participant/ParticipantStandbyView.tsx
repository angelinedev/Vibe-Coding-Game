import React from 'react';
import { useParticipant } from '../../context/ParticipantContext';

export const ParticipantStandbyView: React.FC = () => {
  const { 
    team, 
    member, 
    teamMembers, 
    isArmed, 
    toggleArmed, 
    setCurrentTab, 
    tabSwitchCount,
    contestState,
    questions,
    broadcasts,
    onlinePodsCount,
    contestStats
  } = useParticipant();

  const displayName = member?.display_name || 'Contestant';
  const teamName = team?.name || 'Your Team';
  const maxMembers = team?.max_members || 3;
  const activeQuestion = questions.find(q => q.status === 'live') || questions[0];

  // Build members list with empty slots up to maxMembers
  const slots = Array.from({ length: maxMembers }, (_, idx) => {
    return teamMembers[idx] || null;
  });

  return (
    <div className="w-full flex flex-col">
      <div className="w-full px-gutter py-space-lg flex flex-col gap-space-lg max-w-[1720px] mx-auto">
        {/* HERO MARQUEE BANNER: WAITING STATUS */}
        <section className="relative bg-surface-container-lowest p-space-md shadow-xl overflow-hidden border-2 border-black arcade-shadow">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-container/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-md">
            {/* Status Title */}
            <div className="flex items-center gap-space-md flex-wrap">
              <div className="bg-surface-container-highest px-space-md py-space-sm shadow-md flex items-center gap-space-sm border border-black">
                <span className="inline-flex relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full ${contestState.status === 'running' ? 'bg-tertiary-fixed' : 'bg-secondary'} opacity-75`}></span>
                  <span className={`relative inline-flex h-3 w-3 ${contestState.status === 'running' ? 'bg-tertiary-fixed' : 'bg-secondary'}`}></span>
                </span>
                <span className="font-headline-md text-headline-md uppercase text-primary-container tracking-wider font-bold">
                  Status: {contestState.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-space-xs text-on-surface">
                <span className="font-headline-md text-headline-md tracking-tight uppercase font-bold">
                  {contestState.status === 'running'
                    ? 'Contest in progress — You can start coding!'
                    : contestState.status === 'paused'
                    ? 'Contest is paused by organizer'
                    : 'Waiting for organizer to start contest'}
                </span>
              </div>
            </div>

            {/* Match Details Meta Strip */}
            <div className="flex items-center gap-space-xs flex-wrap font-label-md text-label-md bg-surface-container-high p-space-xs shadow-inner border border-black">
              <div className="px-space-sm py-space-xs bg-surface-container text-primary font-bold">
                Team: <span className="text-tertiary-fixed font-mono">{teamName}</span>
              </div>
              <span className="text-outline font-bold">•</span>
              <div className="px-space-sm py-space-xs bg-surface-container text-on-surface font-bold">
                Code: <span className="text-secondary font-mono">{team?.join_code || 'N/A'}</span>
              </div>
              <span className="text-outline font-bold">•</span>
              <div className="px-space-sm py-space-xs bg-surface-container text-on-surface-variant flex items-center gap-space-xs font-bold">
                <span>Active Teams:</span>
                <span className="text-primary-container font-headline-md text-headline-md font-bold font-mono">
                  {onlinePodsCount}/{contestStats.total_teams}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* MAIN TWO-COLUMN WORKSTATION LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* LEFT COLUMN: TEAM IDENTITY & ROSTER (8 COLS) */}
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            {/* TEAM IDENTITY MODULE */}
            <section className="bg-surface-container p-space-lg shadow-xl relative overflow-hidden border-2 border-black arcade-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
                <div className="flex items-center gap-space-md">
                  <div className="relative w-16 h-16 bg-surface-container-lowest flex items-center justify-center p-2 flex-shrink-0 shadow-md border-2 border-black">
                    <span className="material-symbols-outlined text-[32px] text-primary-container">groups</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs">
                      <span className="bg-primary text-on-primary font-label-sm text-label-sm px-space-xs font-bold uppercase">
                        {team?.status.toUpperCase() || 'ACTIVE'}
                      </span>
                      <span className="font-label-sm text-label-sm text-tertiary-fixed tracking-wider font-bold">
                        Join Code: {team?.join_code || 'N/A'}
                      </span>
                    </div>
                    <h1 className="font-headline-xl text-headline-xl text-primary-container uppercase tracking-tight -mt-1 font-bold">
                      {teamName}
                    </h1>
                    <p className="font-body-sm text-body-sm text-on-surface-variant -mt-1">
                      Your Name: <strong className="text-on-surface">{displayName}</strong>
                    </p>
                  </div>
                </div>

                {/* Score & Member Count Stats Box */}
                <div className="grid grid-cols-2 gap-space-xs bg-surface-container-low p-space-sm sm:min-w-[240px] border border-black">
                  <div className="bg-surface-container-highest p-space-xs flex flex-col border border-black/40">
                    <span className="font-label-sm text-label-sm text-secondary font-bold uppercase">
                      Best Score
                    </span>
                    <span className="font-headline-md text-headline-md text-primary font-bold">
                      {team?.best_score?.toLocaleString() || 0}
                    </span>
                    <span className="font-label-sm text-label-sm text-outline-variant font-bold">
                      Points
                    </span>
                  </div>
                  <div className="bg-surface-container-highest p-space-xs flex flex-col border border-black/40">
                    <span className="font-label-sm text-label-sm text-tertiary-fixed font-bold uppercase">
                      Members
                    </span>
                    <span className="font-headline-md text-headline-md text-tertiary-fixed font-bold font-mono">
                      {teamMembers.length} / {maxMembers}
                    </span>
                    <span className="font-label-sm text-label-sm text-outline-variant font-bold">
                      Slots
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Proctor Ticker */}
              <div className="mt-space-md pt-space-sm bg-surface-container-lowest px-space-md py-space-xs flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm border border-black">
                <span className="flex items-center gap-space-xs font-bold">
                  <span className="w-2 h-2 bg-tertiary-fixed"></span>
                  Proctor Status: {tabSwitchCount >= 3 ? 'Flagged (3+ tab switches)' : 'Clean'}
                </span>
                <span className="text-secondary font-mono tracking-wider font-bold">
                  Tab Switches: {tabSwitchCount} / 3
                </span>
              </div>
            </section>

            {/* TEAM ROSTER PARTY SCREEN */}
            <section className="bg-surface-container flex flex-col shadow-xl border-2 border-black arcade-shadow">
              <div className="h-9 bg-surface-container-lowest px-space-md flex items-center justify-between shadow-sm border-b-2 border-black">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-primary-container text-base">groups</span>
                  <span className="font-headline-md text-headline-md uppercase text-primary text-sm tracking-wide font-bold">
                    Team Members
                  </span>
                </div>
                <span className="font-label-sm text-label-sm bg-surface-container-high px-space-xs py-0.5 text-on-surface-variant font-mono font-bold">
                  {teamMembers.length} / {maxMembers} Members
                </span>
              </div>

              {/* Team Slots Cards Grid */}
              <div className="p-space-lg grid grid-cols-1 md:grid-cols-3 gap-space-md">
                {slots.map((m, idx) => {
                  if (m) {
                    const isSelf = m.user_id === member?.user_id;
                    return (
                      <div
                        key={m.id || idx}
                        className={`bg-surface-container-low p-space-md flex flex-col justify-between min-h-[160px] relative border-2 border-black ${
                          isSelf ? 'border-primary-container arcade-shadow-sm' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="bg-surface-container-lowest px-space-xs py-0.5 font-label-sm text-label-sm text-on-surface-variant font-mono border border-black/40 font-bold">
                            Member {idx + 1}
                          </span>
                          <span className="flex h-2.5 w-2.5 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-fixed opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tertiary-fixed"></span>
                          </span>
                        </div>

                        <div className="my-space-sm flex flex-col">
                          <div className="font-headline-md text-headline-md text-primary truncate font-bold">
                            {m.display_name}
                          </div>
                          <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">
                            {isSelf ? '(You)' : 'Teammate'}
                          </span>
                        </div>

                        <div className="bg-surface-container-lowest p-space-xs flex items-center justify-between text-outline text-[12px] border border-black font-mono">
                          <span>Tab Switches:</span>
                          <strong className={m.tab_switch_count >= 3 ? 'text-error' : 'text-on-surface'}>
                            {m.tab_switch_count}
                          </strong>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="border-2 border-dashed border-outline-variant/50 p-space-md flex flex-col items-center justify-center min-h-[160px] text-center bg-surface-container-lowest/30"
                    >
                      <span className="material-symbols-outlined text-outline-variant text-3xl mb-1">
                        person_add
                      </span>
                      <span className="font-label-md text-label-md text-outline-variant uppercase font-mono font-bold">
                        Slot {idx + 1} Open
                      </span>
                      <span className="text-[12px] text-on-surface-variant font-mono mt-1">
                        Join code: <strong className="text-tertiary-fixed">{team?.join_code}</strong>
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Action Bar: Ready check & Enter arena */}
              <div className="p-space-md bg-surface-container-lowest border-t-2 border-black flex flex-wrap items-center justify-between gap-space-md">
                <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm font-mono">
                  <span className="material-symbols-outlined text-secondary text-base">info</span>
                  <span>Teammates can solve concurrently; highest score is counted.</span>
                </div>

                <div className="flex items-center gap-space-sm w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setCurrentTab('battle-arena')}
                    className="flex-1 sm:flex-none px-space-xl py-space-sm bg-primary-container text-on-primary-fixed hover:bg-tertiary-fixed font-title-sm text-title-sm uppercase font-bold shadow-lg border-2 border-black arcade-shadow-sm active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                  >
                    Enter Arena
                  </button>
                  <button
                    id="ready-check-btn"
                    type="button"
                    onClick={toggleArmed}
                    className={`flex-1 sm:flex-none px-space-lg py-space-sm ${
                      isArmed ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-secondary text-on-secondary'
                    } font-title-sm text-title-sm uppercase font-bold shadow-lg border-2 border-black arcade-shadow-sm active:translate-x-[2px] active:translate-y-[2px] flex items-center justify-center gap-space-sm cursor-pointer`}
                  >
                    <span className="material-symbols-outlined text-base font-bold">check</span>
                    <span>
                      {isArmed ? 'Ready' : 'Standby'}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: RULES & TOURNAMENT DIRECTIVES (4 COLS) */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            {/* RULES CARTRIDGE */}
            <section className="bg-surface-container p-space-md shadow-xl flex flex-col gap-space-sm relative border-2 border-black arcade-shadow">
              <div className="flex items-center justify-between bg-surface-container-lowest p-space-xs border border-black">
                <span className="font-headline-md text-headline-md uppercase text-secondary font-bold text-sm tracking-wider flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-sm">gavel</span>
                  Contest Rules
                </span>
                <span className="font-label-sm text-label-sm bg-primary-container text-on-primary px-space-xs font-bold uppercase">
                  Active
                </span>
              </div>

              {/* Challenge summary if available */}
              <div className="bg-surface-container-low p-space-sm space-y-space-xs font-body-sm text-body-sm border border-black">
                <div className="text-primary font-bold font-title-sm text-title-sm uppercase tracking-wide">
                  Current Challenge:
                </div>
                <p className="text-on-surface font-bold">
                  {activeQuestion ? activeQuestion.title : 'No challenges currently set to live.'}
                </p>
                <div className="text-outline-variant text-[13px] pt-1 border-t border-black/40">
                  Tier: <strong className="text-secondary">{activeQuestion?.tier || 'Standard'}</strong> | Points: <strong className="text-tertiary-fixed">{activeQuestion?.max_points || 100} PTS</strong>
                </div>
              </div>

              <div className="bg-surface-container-low p-space-sm space-y-space-xs font-body-sm text-body-sm border border-black">
                <div className="text-primary font-bold font-title-sm text-title-sm uppercase tracking-wide">
                  Integrity Rules:
                </div>
                <ul className="space-y-space-xs text-on-surface-variant font-body-sm">
                  <li className="flex items-start gap-space-xs">
                    <span className="text-tertiary-fixed font-bold">•</span>
                    <span><strong className="text-on-surface">3 Tab Switch Limit:</strong> Switching away flags your team for proctor review.</span>
                  </li>
                  <li className="flex items-start gap-space-xs">
                    <span className="text-secondary font-bold">•</span>
                    <span><strong className="text-on-surface">Direct Gemini:</strong> Prompts run directly in your browser using your session API key.</span>
                  </li>
                  <li className="flex items-start gap-space-xs">
                    <span className="text-primary-container font-bold">•</span>
                    <span><strong className="text-on-surface">Team Score:</strong> Best score per problem counts toward your standing.</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* LIVE BROADCAST FEED */}
            <section className="bg-surface-container flex flex-col shadow-xl border-2 border-black arcade-shadow">
              <div className="h-9 bg-surface-container-lowest px-space-md flex items-center justify-between shadow-sm border-b-2 border-black">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-secondary text-base">campaign</span>
                  <span className="font-headline-md text-headline-md uppercase text-primary text-sm tracking-wide font-bold">
                    Announcements
                  </span>
                </div>
              </div>

              <div className="p-space-md flex flex-col gap-space-sm font-mono text-body-sm">
                {broadcasts.length === 0 ? (
                  <div className="text-center py-6 text-on-surface-variant">
                    No announcements yet.
                  </div>
                ) : (
                  broadcasts.slice(0, 5).map((b) => (
                    <div key={b.id} className="bg-surface-container-lowest p-space-sm border border-black flex flex-col gap-1">
                      <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
                        <span className="text-tertiary-fixed font-bold">[{new Date(b.created_at).toLocaleTimeString()}]</span>
                        <span className={`px-1 py-0.5 uppercase font-bold text-[10px] ${b.priority === 'alert' ? 'bg-error-container text-white' : 'bg-primary-container text-black'}`}>
                          {b.priority}
                        </span>
                      </div>
                      <div className="text-on-surface font-bold">{b.message}</div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
