import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/audio';

interface AdminLoginViewProps {
  onLoginSuccess: () => void;
  onNavigateToArena: () => void;
  initialError?: string | null;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({ onLoginSuccess, onNavigateToArena, initialError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  // Sync initialError if passed later
  useEffect(() => {
    if (initialError) {
      setErrorMessage(initialError);
    }
  }, [initialError]);

  // Throttling state (in-memory)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both administrative email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    playSound.click();

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError || !authData.user) {
        playSound.warning();
        const msg = authError?.message?.toLowerCase() || '';

        // Check if error is due to backend unreachable or offline
        if (
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('failed to fetch') ||
          msg.includes('unreachable') ||
          authError?.status === 0 ||
          authError?.status === 503 ||
          authError?.status === 504
        ) {
          setErrorMessage('Backend unreachable. Supabase service or network is offline.');
          setIsLoading(false);
          return;
        }

        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        
        if (nextFailed >= 5) {
          setLockoutSeconds(30);
          setErrorMessage('SECURITY PROTOCOL TRIGGERED: 5 consecutive failed attempts. Terminal locked for 30s.');
        } else {
          setErrorMessage(`Invalid email or password. (${nextFailed}/5 attempts)`);
        }
        setIsLoading(false);
        return;
      }

      // 2. Server-side verification: check admins table (enforced by RLS)
      const { data: adminRow, error: adminError } = await supabase
        .from('admins')
        .select('id, email')
        .eq('id', authData.user.id)
        .single();

      if (adminError || !adminRow) {
        // Not an authorized administrator! Sign out immediately.
        await supabase.auth.signOut();
        playSound.warning();
        setErrorMessage('Account exists but is not an administrator.');
        setIsLoading(false);
        return;
      }

      // 3. Success
      playSound.start();
      setFailedAttempts(0);
      onLoginSuccess();
    } catch (err: any) {
      playSound.warning();
      const msg = err?.message?.toLowerCase() || '';
      if (
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('failed to fetch') ||
        msg.includes('unreachable')
      ) {
        setErrorMessage('Backend unreachable. Supabase service or network is offline.');
      } else {
        setErrorMessage(err?.message || 'Unexpected server connection failure.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isLocked = lockoutSeconds > 0;

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased relative flex flex-col items-center justify-center p-gutter selection:bg-primary-container selection:text-on-primary">
      {/* Background Pixel & Scanline Layers */}
      <div className="fixed inset-0 pointer-events-none pixel-dot-grid opacity-10 z-0"></div>
      <div className="fixed inset-0 pointer-events-none scanline-layer opacity-20 z-0"></div>

      {/* Top Navigation Strip */}
      <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-surface-container-lowest px-space-sm py-1 border-2 border-black arcade-shadow-sm font-mono text-label-sm font-bold text-on-surface">
          <span className="w-2.5 h-2.5 bg-error animate-pulse"></span>
          <span>Super Admin Console</span>
        </div>

        <button
          onClick={onNavigateToArena}
          className="bg-surface-container-high hover:bg-surface-bright text-primary px-space-sm py-1 border-2 border-black arcade-shadow-sm font-title-sm text-title-sm uppercase font-bold flex items-center gap-1 active:translate-y-0.5 cursor-pointer"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">sports_esports</span>
          <span>Return to Arena</span>
        </button>
      </div>

      <main className="w-full max-w-lg relative z-10 my-auto">
        <div className="flex flex-col w-full items-center justify-center p-space-xs sm:p-space-sm select-none">
          {/* Terminal Header Ribbon */}
          <div className="w-full flex items-center justify-between mb-space-sm px-space-xs text-on-surface">
            <div className="flex items-center gap-space-xs bg-surface-container-lowest px-space-sm py-1 shadow-[2px_2px_0px_#000000]">
              <span className="inline-block w-2 h-2 bg-primary-container animate-pulse"></span>
              <span className="font-label-sm text-label-sm text-primary-container tracking-wider font-bold font-mono">
                Admin Authentication
              </span>
            </div>
            <div className="flex items-center gap-space-xs bg-error-container text-white px-space-sm py-1 shadow-[2px_2px_0px_#000000]">
              <span className="material-symbols-outlined text-[14px]">shield</span>
              <span className="font-label-sm text-label-sm font-bold tracking-wider font-mono">
                Organizers Only
              </span>
            </div>
          </div>

          {/* Main Terminal Window */}
          <div className="w-full bg-surface-container relative shadow-[4px_4px_0px_#000000,8px_8px_0px_#11072a] border-2 border-black">
            {/* Title Bar */}
            <div className="bg-surface-container-lowest px-space-md py-space-sm flex items-center justify-between border-b-2 border-black">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 bg-surface-container-highest flex items-center justify-center text-primary-container relative shadow-[2px_2px_0px_#000000] border border-black">
                  <span className="material-symbols-outlined text-[20px] text-error font-bold">
                    admin_panel_settings
                  </span>
                </div>
                <div>
                  <h1 className="font-headline-md text-headline-md text-primary tracking-wider uppercase font-bold">
                    Super Admin Login
                  </h1>
                  <span className="text-on-surface-variant font-label-sm text-label-sm uppercase font-mono">
                    Prompt Arena Master Control
                  </span>
                </div>
              </div>
            </div>

            {/* Form Container */}
            <div className="p-space-lg flex flex-col gap-space-lg bg-surface-container">
              {/* Error / Alert Message Banner */}
              {errorMessage && (
                <div className="bg-error-container text-white p-space-sm border-2 border-black shadow-[2px_2px_0px_#000000] flex items-start gap-space-xs font-mono text-body-sm animate-pulse">
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0">warning</span>
                  <div>{errorMessage}</div>
                </div>
              )}

              {/* Lockout Notice */}
              {isLocked && (
                <div className="bg-surface-container-lowest p-space-md border-2 border-error text-center font-mono">
                  <div className="text-error font-bold text-headline-md">
                    Terminal Locked: {lockoutSeconds}s
                  </div>
                  <div className="text-on-surface-variant text-label-sm mt-1">
                    Too many unauthorized access attempts.
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
                {/* Admin Email */}
                <div className="flex flex-col gap-space-xs">
                  <label className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold flex items-center justify-between">
                    <span>Admin Email</span>
                    <span className="text-on-surface-variant font-mono text-[11px] font-normal">
                      Required
                    </span>
                  </label>
                  <div className="flex items-center bg-surface-container-lowest border-2 border-black p-space-xs shadow-[2px_2px_0px_#000000] focus-within:border-primary-container">
                    <span className="material-symbols-outlined text-on-surface-variant px-space-xs text-[18px]">
                      mail
                    </span>
                    <input
                      type="email"
                      id="admin-email-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading || isLocked}
                      placeholder="admin@example.com"
                      autoComplete="username"
                      className="w-full bg-transparent font-mono text-body-md text-on-surface focus:outline-none px-space-xs"
                      required
                    />
                  </div>
                </div>

                {/* Admin Password */}
                <div className="flex flex-col gap-space-xs">
                  <label className="font-label-md text-label-md uppercase tracking-wider text-primary font-bold flex items-center justify-between">
                    <span>Password</span>
                    <span className="text-on-surface-variant font-mono text-[11px] font-normal">
                      Required
                    </span>
                  </label>
                  <div className="flex items-center bg-surface-container-lowest border-2 border-black p-space-xs shadow-[2px_2px_0px_#000000] focus-within:border-primary-container">
                    <span className="material-symbols-outlined text-on-surface-variant px-space-xs text-[18px]">
                      key
                    </span>
                    <input
                      type={isRevealed ? 'text' : 'password'}
                      id="admin-password-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading || isLocked}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      className="w-full bg-transparent font-mono text-body-md text-on-surface focus:outline-none px-space-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setIsRevealed(!isRevealed)}
                      className="px-2 text-on-surface-variant hover:text-on-surface text-[14px] cursor-pointer"
                      title={isRevealed ? 'Hide Password' : 'Show Password'}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isRevealed ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="pt-space-sm">
                  <button
                    type="submit"
                    id="admin-login-btn"
                    disabled={isLoading || isLocked}
                    className="w-full bg-primary-container hover:bg-tertiary-fixed text-on-primary-fixed py-space-md font-headline-md text-headline-md uppercase font-bold border-2 border-black arcade-shadow-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-space-sm cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-[20px] ${isLoading ? 'animate-spin' : ''}`}>
                      {isLoading ? 'progress_activity' : 'login'}
                    </span>
                    <span>
                      {isLoading
                        ? 'Verifying...'
                        : isLocked
                        ? `Locked (${lockoutSeconds}s)`
                        : 'Sign In to Console'}
                    </span>
                  </button>
                </div>
              </form>

              {/* Security Footnote */}
              <div className="bg-surface-container-lowest p-space-sm border border-black text-on-surface-variant font-mono text-[12px] flex flex-col gap-1">
                <div className="flex items-center gap-1 text-tertiary-fixed font-bold">
                  <span className="material-symbols-outlined text-[14px]">shield</span>
                  <span>Security Notice:</span>
                </div>
                <div>
                  Only pre-registered admin accounts can access tournament controls, question answers, and audit logs.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
