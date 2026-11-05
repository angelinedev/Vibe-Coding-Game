import React from 'react';

interface NotFoundPageProps {
  onHome: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onHome }) => {
  return (
    <div className="min-h-screen bg-[#07070a] text-white font-mono flex flex-col items-center justify-center p-6 selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      {/* CRT scanline effect */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#111_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

      <div className="relative max-w-lg w-full bg-[#0d0d12] border-[4px] border-cyan-500 shadow-[8px_8px_0px_#000000] p-8 z-10 text-center">
        <div className="flex items-center justify-center gap-3 border-b-2 border-cyan-900 pb-4 mb-6">
          <span className="w-3 h-3 bg-red-500 animate-ping inline-block" />
          <h1 className="font-['Press_Start_2P'] text-cyan-400 text-3xl tracking-widest">
            404
          </h1>
          <span className="w-3 h-3 bg-cyan-400 animate-ping inline-block" />
        </div>

        <p className="font-['VT323'] text-2xl text-amber-400 uppercase tracking-widest mb-3">
          Signal Lost - Sector 404
        </p>

        <p className="font-['Space_Mono'] text-xs text-neutral-400 leading-relaxed mb-8">
          The requested page does not exist or has been moved.
        </p>

        <button
          id="return-home-button"
          onClick={onHome}
          className="px-6 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-black font-['Press_Start_2P'] text-xs uppercase font-bold shadow-[4px_4px_0px_#000000] active:translate-y-0.5 cursor-pointer transition-colors"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
};
