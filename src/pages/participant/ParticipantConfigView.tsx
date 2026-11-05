import React, { useState } from 'react';
import { useParticipant } from '../../context/ParticipantContext';

export const ParticipantConfigView: React.FC = () => {
  const {
    team,
    geminiApiKey,
    setGeminiApiKey,
    selectedModel,
    setSelectedModel,
    lastProbeResult,
    runProbeTest,
    setCurrentTab,
  } = useParticipant();

  const [inputKey, setInputKey] = useState(geminiApiKey);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleTestProbe = async () => {
    setIsTesting(true);
    await runProbeTest(inputKey.trim());
    setIsTesting(false);
  };

  const handleSaveAndLock = () => {
    setGeminiApiKey(inputKey.trim());
    setSaveStatus('Key Saved');
    setTimeout(() => {
      setSaveStatus('✓ Key Active');
      setTimeout(() => setSaveStatus(null), 2000);
    }, 300);
  };

  return (
    <div className="w-full flex flex-col">
      <div className="w-full px-gutter py-space-lg max-w-7xl mx-auto flex flex-col gap-space-lg">
        {/* Top Breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-lowest p-space-md shadow-xl border-2 border-black arcade-shadow">
          <div className="flex items-center gap-space-md">
            <div className="bg-secondary-container text-on-secondary-container px-space-sm py-space-xs font-label-md text-label-md uppercase tracking-wider flex items-center gap-space-xs shadow-md border border-black font-bold">
              <span className="material-symbols-outlined text-[14px]">vpn_key</span>
              <span>API Key Settings</span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className={`w-2.5 h-2.5 ${geminiApiKey ? 'bg-tertiary-fixed' : 'bg-secondary'} shadow-[0_0_8px_currentColor] animate-pulse`}></span>
            <span className="text-tertiary font-label-md text-label-md uppercase tracking-wider font-bold">
              {geminiApiKey ? 'API Key: Connected' : 'API Key: Not Entered'}
            </span>
          </div>
        </div>

        {/* Main Cabinet Bento Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          {/* LEFT / MAIN CONFIG PANEL (Col 1-8) */}
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            <div className="bg-surface-container rounded-none shadow-2xl flex flex-col overflow-hidden border-2 border-black arcade-shadow">
              {/* Arcade Title Bar */}
              <div className="bg-surface-container-lowest px-space-md py-space-sm flex items-center justify-between border-b-2 border-black">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-primary-container text-[20px]">
                    key
                  </span>
                  <h1 className="font-headline-md text-headline-md text-primary tracking-tight uppercase font-bold">
                    Gemini API Key
                  </h1>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className="px-space-xs py-[2px] bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-mono border border-black">
                    Team: {team?.name || 'Unassigned'}
                  </span>
                </div>
              </div>

              {/* Mission Objective */}
              <div className="bg-surface-container-low p-space-md flex items-start gap-space-md border-b-2 border-black">
                <div className="p-space-xs bg-surface-container-highest text-primary-fixed flex-shrink-0 border border-black">
                  <span className="material-symbols-outlined text-[20px]">info</span>
                </div>
                <div className="flex flex-col gap-space-xs">
                  <p className="font-headline-md text-headline-md text-on-surface font-bold">
                    Enter your Google AI Studio API key to run prompts.
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Your key stays in this browser tab only and is used directly to evaluate challenges. It is never saved to any database.
                  </p>
                </div>
              </div>

              {/* Configuration Body */}
              <div className="p-space-lg flex flex-col gap-space-lg">
                {/* API KEY INPUT */}
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <label
                      className="font-label-md text-label-md uppercase text-primary tracking-wider font-bold"
                      htmlFor="apiKeyField"
                    >
                      Gemini API Key
                    </label>
                    <a
                      className="font-label-sm text-label-sm text-primary-container hover:text-tertiary-fixed underline flex items-center gap-space-xs font-bold"
                      href="https://aistudio.google.com/app/apikey"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <span>Get Free Key from Google AI Studio</span>
                      <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                    </a>
                  </div>

                  <div className="relative flex items-center bg-surface-container-lowest p-space-xs shadow-md border-2 border-black">
                    <input
                      id="apiKeyField"
                      type={isRevealed ? 'text' : 'password'}
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value)}
                      placeholder="Paste your Gemini API key (AIzaSy...)"
                      className="w-full bg-transparent font-body-md text-body-md text-primary px-space-sm py-space-xs focus:outline-none placeholder:text-outline-variant tracking-wider caret-tertiary-fixed font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setIsRevealed(!isRevealed)}
                      className="flex-shrink-0 bg-surface-container-high hover:bg-surface-variant px-space-md py-space-xs text-primary font-title-sm text-title-sm flex items-center gap-space-xs shadow-sm transition-transform active:translate-y-0.5 border border-black font-bold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isRevealed ? 'visibility_off' : 'visibility'}
                      </span>
                      <span>{isRevealed ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                </div>

                {/* ENGINE STATUS */}
                <div className="flex items-center justify-between p-space-md bg-surface-container-low border-2 border-black">
                  <div className="flex items-center gap-space-sm">
                    <span className="w-3 h-3 bg-tertiary-fixed inline-block border border-black animate-pulse"></span>
                    <span className="font-title-sm text-title-sm uppercase text-primary tracking-wider font-bold">
                      Model: Gemini Flash (Fast & Free)
                    </span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-mono bg-surface-container-lowest px-space-sm py-0.5 border border-black">
                    {selectedModel || 'gemini-2.5-flash'}
                  </span>
                </div>

                {/* PROBE RUNNER BUTTON */}
                <div className="pt-space-xs">
                  <button
                    type="button"
                    disabled={isTesting || !inputKey.trim()}
                    onClick={handleTestProbe}
                    className="w-full bg-secondary-container hover:bg-primary-container text-on-secondary-container hover:text-on-primary-fixed p-space-md flex items-center justify-center gap-space-md font-headline-md text-headline-md uppercase tracking-wide shadow-xl transition-all active:translate-x-1 active:translate-y-1 border-2 border-black arcade-shadow-sm font-bold disabled:opacity-50 cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-[24px] ${isTesting ? 'animate-spin' : ''}`}>
                      {isTesting ? 'refresh' : 'check_circle'}
                    </span>
                    <span>
                      {isTesting ? 'Testing Connection...' : 'Test API Key'}
                    </span>
                  </button>
                </div>

                {/* TEST BENCH READOUT */}
                <div className="flex flex-col gap-space-md pt-space-sm">
                  <span className="font-label-md text-label-md uppercase text-on-surface-variant tracking-wider font-bold">
                    Connection Status:
                  </span>

                  {!lastProbeResult ? (
                    <div className="bg-surface-container-lowest p-space-md text-center text-on-surface-variant font-body-sm border border-black">
                      Enter your key and click 'Test API Key' to verify.
                    </div>
                  ) : lastProbeResult.ok ? (
                    <div className="bg-surface-container-lowest p-space-md flex flex-col gap-space-sm shadow-md border-2 border-black">
                      <div className="flex flex-wrap items-center justify-between gap-space-sm">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-6 h-6 bg-tertiary-container flex items-center justify-center text-on-tertiary-container font-bold border border-black">
                            <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                          </div>
                          <span className="font-title-sm text-title-sm text-tertiary-fixed uppercase tracking-wider font-bold">
                            ✓ Key Verified Successfully
                          </span>
                        </div>
                        <span className="bg-surface-container-high px-space-sm py-0.5 text-tertiary font-label-sm text-label-sm font-bold border border-black">
                          Connected
                        </span>
                      </div>

                      <div className="bg-surface-container p-space-sm font-label-md text-label-md text-on-surface flex flex-wrap items-center justify-between gap-space-sm border border-black font-mono">
                        <div className="flex items-center gap-space-xs">
                          <span className="text-on-surface-variant font-bold">Latency:</span>
                          <span className="text-primary-container font-bold">
                            {lastProbeResult.latency}ms
                          </span>
                        </div>
                        <span className="text-outline-variant">•</span>
                        <div className="flex items-center gap-space-xs">
                          <span className="text-on-surface-variant font-bold">Engine:</span>
                          <span className="text-secondary font-bold">
                            {lastProbeResult.engine}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface-container-lowest p-space-md flex flex-col gap-space-sm shadow-md border-2 border-error">
                      <div className="flex flex-wrap items-center justify-between gap-space-sm">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-6 h-6 bg-error-container flex items-center justify-center text-on-error-container font-bold border border-black">
                            <span className="material-symbols-outlined text-[16px] font-bold">priority_high</span>
                          </div>
                          <span className="font-title-sm text-title-sm text-error uppercase tracking-wider font-bold">
                            Connection Failed: {lastProbeResult.error || 'Invalid Key'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Save Action */}
              <div className="bg-surface-container-lowest p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-md border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setCurrentTab('battle-arena')}
                  className="w-full sm:w-auto px-space-lg py-space-sm bg-surface-container-high hover:bg-surface-variant text-on-surface font-title-sm text-title-sm uppercase tracking-wider shadow-md transition-transform active:translate-y-0.5 border-2 border-black font-bold cursor-pointer"
                >
                  Return to Arena
                </button>
                <button
                  id="saveBtn"
                  type="button"
                  onClick={handleSaveAndLock}
                  className="w-full sm:w-auto px-space-xl py-space-sm bg-tertiary-container hover:bg-tertiary-fixed text-on-tertiary-container font-headline-md text-headline-md uppercase font-bold tracking-wider shadow-xl transition-all active:translate-x-1 active:translate-y-1 border-2 border-black arcade-shadow-sm cursor-pointer"
                >
                  {saveStatus || 'Save Key'}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR / SECURITY INFO */}
          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            <div className="bg-surface-container p-space-lg flex flex-col gap-space-md shadow-2xl relative overflow-hidden border-2 border-black arcade-shadow">
              <div className="flex items-center gap-space-sm text-secondary-fixed">
                <span className="material-symbols-outlined text-[24px]">lock</span>
                <span className="font-title-sm text-title-sm uppercase tracking-widest font-bold">
                  Security & Privacy
                </span>
              </div>
              <div className="p-space-md bg-surface-container-lowest text-secondary-fixed flex flex-col gap-space-xs shadow-md border-2 border-black">
                <p className="font-body-md text-body-md leading-relaxed text-secondary-fixed font-bold">
                  Your key is held strictly in browser memory. It is never saved to localStorage, cookies, or any database.
                </p>
              </div>
              <ul className="flex flex-col gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                <li className="flex items-center gap-space-xs">
                  <span className="text-tertiary-fixed font-bold">✔</span>
                  <span>Direct browser calls to Google Gemini API</span>
                </li>
                <li className="flex items-center gap-space-xs">
                  <span className="text-tertiary-fixed font-bold">✔</span>
                  <span>Zero server-side key logging or storage</span>
                </li>
                <li className="flex items-center gap-space-xs">
                  <span className="text-tertiary-fixed font-bold">✔</span>
                  <span>Automatically cleared when you reload or close the tab</span>
                </li>
              </ul>
            </div>

            <div className="bg-surface-container flex flex-col shadow-xl border-2 border-black arcade-shadow">
              <div className="bg-surface-container-lowest px-space-md py-space-xs flex items-center justify-between border-b border-black">
                <span className="font-title-sm text-title-sm uppercase text-primary tracking-wider font-bold">
                  Key Status
                </span>
              </div>
              <div className="p-space-md flex flex-col gap-space-sm font-body-sm text-body-sm text-on-surface-variant font-mono">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={geminiApiKey ? 'text-tertiary-fixed font-bold' : 'text-secondary font-bold'}>
                    {geminiApiKey ? 'Active in Session' : 'Not Loaded'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Storage:</span>
                  <span className="text-tertiary-fixed font-bold">Browser Memory Only</span>
                </div>
                <div className="flex justify-between">
                  <span>Database:</span>
                  <span className="text-secondary font-bold">Never Stored</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
