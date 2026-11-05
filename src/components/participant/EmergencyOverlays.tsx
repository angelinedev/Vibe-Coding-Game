import React from 'react';
import { useParticipant, EmergencyModalType } from '../../context/ParticipantContext';

export const EmergencyOverlays: React.FC = () => {
  const { activeModal, setActiveModal, setCurrentTab, team } = useParticipant();

  if (activeModal === 'none') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-gutter bg-black/80 backdrop-blur-sm select-none">
      {/* ========================================================
          MODAL 1: TIME'S UP (TIMEOUT)
      ======================================================== */}
      {activeModal === 'modal-timeout' && (
        <div className="w-full max-w-xl bg-surface-container border-4 border-black arcade-shadow relative animate-bounce-short">
          {/* Header */}
          <div className="bg-secondary-container px-space-md py-space-sm flex items-center justify-between text-on-secondary-container">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[24px]">timer_off</span>
              <span className="font-headline-md text-headline-md uppercase font-bold tracking-wider">
                Time's Up
              </span>
            </div>
            <button
              onClick={() => setActiveModal('none')}
              className="w-7 h-7 bg-surface-container-lowest text-on-surface hover:text-error flex items-center justify-center font-bold border-2 border-black cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-space-lg flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest p-space-md flex items-center gap-space-md border-2 border-black">
              <span className="text-[48px] animate-pulse">⏰</span>
              <div className="flex flex-col">
                <span className="text-secondary font-headline-md text-headline-md uppercase font-bold">
                  Contest Concluded
                </span>
                <p className="text-body-sm text-body-sm text-on-surface-variant">
                  The contest clock has reached zero. Prompt evaluations are locked.
                </p>
              </div>
            </div>

            <div className="bg-surface-container-low p-space-sm font-label-md text-label-md text-on-surface flex justify-between">
              <span>Final Team Score:</span>
              <span className="text-primary-container font-bold">
                {team?.best_score != null ? `${team.best_score.toLocaleString()} PTS` : '0 PTS'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-space-sm pt-space-xs">
              <button
                onClick={() => {
                  setActiveModal('none');
                  setCurrentTab('leaderboard');
                }}
                className="flex-1 py-space-sm px-space-md bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary font-title-sm text-title-sm uppercase font-bold border-2 border-black arcade-shadow-sm active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                View Leaderboard
              </button>
              <button
                onClick={() => setActiveModal('none')}
                className="py-space-sm px-space-md bg-surface-container-high hover:bg-surface-bright text-on-surface font-title-sm text-title-sm uppercase border-2 border-black active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: DISQUALIFIED (DQ ENFORCED)
      ======================================================== */}
      {activeModal === 'modal-dq' && (
        <div className="w-full max-w-xl bg-surface-container border-4 border-error arcade-shadow relative animate-shake">
          {/* Header */}
          <div className="bg-error-container text-on-error-container px-space-md py-space-sm flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <span className="font-headline-md text-headline-md uppercase font-bold tracking-wider">
                Tab Limit Reached
              </span>
            </div>
            <button
              onClick={() => setActiveModal('none')}
              className="w-7 h-7 bg-on-error text-error flex items-center justify-center font-bold border-2 border-black cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-space-lg flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest p-space-md flex items-start gap-space-md border-2 border-black">
              <div className="w-12 h-12 bg-on-error text-error flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[32px]">warning</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-error font-title-sm text-title-sm uppercase font-bold">
                  Rule Infraction: 3/3 Tab Switches Detected
                </span>
                <p className="text-body-sm text-body-sm text-on-error-container leading-relaxed">
                  Switching outside the prompt arena window during the contest is flagged for proctor review.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-space-sm pt-space-xs">
              <button
                onClick={() => setActiveModal('none')}
                className="flex-1 py-space-sm px-space-md bg-error text-on-error hover:bg-error-container font-title-sm text-title-sm uppercase font-bold border-2 border-black arcade-shadow-sm active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: API KEY ERROR
      ======================================================== */}
      {activeModal === 'modal-key' && (
        <div className="w-full max-w-xl bg-surface-container border-4 border-black arcade-shadow relative">
          {/* Header */}
          <div className="bg-surface-container-lowest px-space-md py-space-sm flex items-center justify-between border-b-2 border-black">
            <div className="flex items-center gap-space-sm text-secondary">
              <span className="material-symbols-outlined text-[24px]">key_off</span>
              <span className="font-headline-md text-headline-md uppercase font-bold tracking-wider">
                Gemini API Key Error
              </span>
            </div>
            <button
              onClick={() => setActiveModal('none')}
              className="w-7 h-7 bg-surface-container text-on-surface flex items-center justify-center font-bold border-2 border-black cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-space-lg flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest p-space-md flex items-start gap-space-md border-2 border-black">
              <span className="material-symbols-outlined text-[36px] text-secondary">vpn_key_alert</span>
              <div className="flex flex-col gap-1">
                <span className="text-secondary font-headline-md text-headline-md uppercase font-bold">
                  Invalid or Expired API Key
                </span>
                <p className="text-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Google Gemini returned an error. Your key might be mistyped, expired, or out of quota.
                </p>
              </div>
            </div>

            <div className="bg-surface-container-low p-space-sm font-label-md text-label-md text-on-surface flex justify-between">
              <span>Engine:</span>
              <span className="text-primary-container font-bold">Gemini 2.5 Flash</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-space-sm pt-space-xs">
              <button
                onClick={() => {
                  setActiveModal('none');
                  setCurrentTab('api-key-config');
                }}
                className="flex-1 py-space-sm px-space-md bg-primary-container text-on-primary-fixed hover:bg-tertiary-fixed font-title-sm text-title-sm uppercase font-bold border-2 border-black arcade-shadow-sm active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Configure API Key
              </button>
              <button
                onClick={() => setActiveModal('none')}
                className="py-space-sm px-space-md bg-surface-container-high hover:bg-surface-bright text-on-surface font-title-sm text-title-sm uppercase border-2 border-black active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: LEADERBOARD FREEZE
      ======================================================== */}
      {activeModal === 'modal-freeze' && (
        <div className="w-full max-w-xl bg-surface-container border-4 border-black arcade-shadow relative">
          {/* Header */}
          <div className="bg-surface-container-high px-space-md py-space-sm flex items-center justify-between border-b-2 border-black">
            <div className="flex items-center gap-space-sm text-primary-container">
              <span className="material-symbols-outlined text-[24px]">ac_unit</span>
              <span className="font-headline-md text-headline-md uppercase font-bold tracking-wider">
                Leaderboard Frozen
              </span>
            </div>
            <button
              onClick={() => setActiveModal('none')}
              className="w-7 h-7 bg-surface-container-lowest text-on-surface flex items-center justify-center font-bold border-2 border-black cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-space-lg flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest p-space-md flex items-start gap-space-md border-2 border-black">
              <span className="material-symbols-outlined text-[40px] text-primary-container">ac_unit</span>
              <div className="flex flex-col gap-1">
                <span className="text-primary font-headline-md text-headline-md uppercase font-bold">
                  Final Sprint in Effect
                </span>
                <p className="text-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Public rankings are frozen for the final sprint. Your solves and points will still count!
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-space-sm pt-space-xs">
              <button
                onClick={() => {
                  setActiveModal('none');
                  setCurrentTab('battle-arena');
                }}
                className="flex-1 py-space-sm px-space-md bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary font-title-sm text-title-sm uppercase font-bold border-2 border-black arcade-shadow-sm active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Resume Coding
              </button>
              <button
                onClick={() => setActiveModal('none')}
                className="py-space-sm px-space-md bg-surface-container-high hover:bg-surface-bright text-on-surface font-title-sm text-title-sm uppercase border-2 border-black active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
