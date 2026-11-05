import React from 'react';

interface BackendNotConfiguredProps {
  missingVars?: string[];
}

export const BackendNotConfigured: React.FC<BackendNotConfiguredProps> = ({
  missingVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
}) => {
  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-6 selection:bg-red-500 selection:text-black">
      {/* Scanline CRT overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#111_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

      <div className="relative max-w-2xl w-full bg-[#0a0a0c] border-[4px] border-red-600 shadow-[8px_8px_0px_#ef4444] p-8 z-10">
        {/* Header alert */}
        <div className="flex items-center gap-3 border-b-[3px] border-red-900 pb-4 mb-6">
          <span className="w-4 h-4 bg-red-600 animate-ping inline-block" />
          <h1 className="font-['Press_Start_2P'] text-red-500 text-lg md:text-xl tracking-wider leading-relaxed">
            BACKEND NOT CONFIGURED
          </h1>
        </div>

        {/* Warning text */}
        <div className="space-y-4 mb-6 text-sm text-neutral-300">
          <p className="font-['VT323'] text-xl text-red-400 uppercase tracking-wide">
            CRITICAL ERROR: Silent mock mode is permanently disabled. The arena cannot connect to Supabase.
          </p>

          <div className="bg-red-950/40 border border-red-800 p-4 font-mono text-xs text-red-200">
            <span className="font-bold text-red-400 block mb-2">[ MISSING REQUIRED ENVIRONMENT VARIABLES ]:</span>
            <ul className="list-disc list-inside space-y-1">
              {missingVars.map((v) => (
                <li key={v} className="text-amber-300 font-bold tracking-wider">
                  {v}
                </li>
              ))}
            </ul>
          </div>

          <p className="font-['Space_Mono'] text-xs text-neutral-400 leading-relaxed">
            Create a <code className="text-white bg-neutral-800 px-1.5 py-0.5 border border-neutral-700">.env.local</code> file in the project root with your credentials:
          </p>

          <div className="bg-neutral-900 border-2 border-neutral-700 p-4 font-mono text-xs overflow-x-auto text-emerald-400">
            <div className="text-neutral-500 mb-2"># Copy to .env.local</div>
            <div>VITE_SUPABASE_URL=https://mgflhsdwabhontyldzkq.supabase.co</div>
            <div>VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsIn...</div>
            <div className="text-neutral-500 mt-2"># Or for hosted Supabase:</div>
            <div>VITE_SUPABASE_URL=https://mgflhsdwabhontyldzkq.supabase.co</div>
            <div>VITE_SUPABASE_ANON_KEY=sb_publishable_...</div>
          </div>

          <p className="font-['VT323'] text-base text-neutral-400">
            Refer to <strong className="text-neutral-200">README.md (Section 7)</strong> or the <strong className="text-neutral-200">.env.example</strong> template for setup instructions.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t-2 border-neutral-800">
          <button
            id="reload-app-button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 hover:bg-red-500 text-black font-['Press_Start_2P'] text-xs uppercase font-bold shadow-[4px_4px_0px_#000000] active:translate-y-0.5 cursor-pointer transition-colors"
          >
            [ RECHECK CONNECTION ]
          </button>
          <span className="font-['VT323'] text-sm text-neutral-500 uppercase">
            Vite dev server reloads automatically after creating .env.local
          </span>
        </div>
      </div>
    </div>
  );
};
