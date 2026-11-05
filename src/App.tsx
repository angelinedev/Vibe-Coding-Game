import React, { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, missingEnvVars } from './lib/supabase';
import { BackendNotConfigured } from './components/BackendNotConfigured';
import { ArenaProvider } from './context/ArenaContext';
import { ParticipantProvider } from './context/ParticipantContext';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './pages/DashboardView';
import { TeamsView } from './pages/TeamsView';
import { LeaderboardView } from './pages/LeaderboardView';
import { ControlsView } from './pages/ControlsView';
import { QuestionsView } from './pages/QuestionsView';
import { AuditLogView } from './pages/AuditLogView';
import { ParticipantPortal } from './pages/participant/ParticipantPortal';
import { AdminLoginView } from './pages/AdminLoginView';
import { LandingPage } from './pages/LandingPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  const parseAdminTabFromPath = (path: string): ActiveTab => {
    if (path.startsWith('/admin/teams')) return 'teams';
    if (path.startsWith('/admin/questions')) return 'questions-bank';
    if (path.startsWith('/admin/leaderboard')) return 'leaderboard';
    if (path.startsWith('/admin/controls')) return 'arena-controls';
    if (path.startsWith('/admin/audit')) return 'system-audit-log';
    return 'dashboard';
  };

  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [isAdminVerified, setIsAdminVerified] = useState<boolean>(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState<boolean>(true);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [currentAdminTab, setCurrentAdminTab] = useState<ActiveTab>(() => parseAdminTabFromPath(window.location.pathname));

  // Handle browser back/forward and path updates
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
      if (path.startsWith('/admin')) {
        setCurrentAdminTab(parseAdminTabFromPath(path));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    if (path.startsWith('/admin')) {
      setCurrentAdminTab(parseAdminTabFromPath(path));
    }
  };

  // Verify whether current session belongs to a verified admin in public.admins
  const checkAdminAuth = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsCheckingAdmin(false);
      setIsAdminVerified(false);
      return;
    }

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (!user || sessionErr) {
        setIsAdminVerified(false);
        setIsCheckingAdmin(false);
        return;
      }

      // Verify row in admins table via RLS (is_admin() must be true)
      const { data: adminRow, error: adminErr } = await supabase
        .from('admins')
        .select('id, email')
        .eq('id', user.id)
        .single();

      if (adminRow && !adminErr) {
        setIsAdminVerified(true);
        setAdminAuthError(null);
      } else {
        // If a participant (anonymous user) or non-admin account opens /admin/*,
        // sign them out of that session and show the login with "Not authorized"
        const isAccessingAdmin = window.location.pathname.startsWith('/admin');
        if (isAccessingAdmin) {
          await supabase.auth.signOut();
          setIsAdminVerified(false);
          setAdminAuthError('Not authorized');
        } else {
          setIsAdminVerified(false);
        }
      }
    } catch {
      setIsAdminVerified(false);
    } finally {
      setIsCheckingAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsCheckingAdmin(false);
      return;
    }

    checkAdminAuth();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsAdminVerified(false);
      } else {
        checkAdminAuth();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [checkAdminAuth]);

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    setIsAdminVerified(false);
    setAdminAuthError(null);
    navigateTo('/admin');
  };

  // If Supabase environment variables are missing, refuse to silently run disconnected
  if (!isSupabaseConfigured) {
    return <BackendNotConfigured missingVars={missingEnvVars} />;
  }

  const isHomeRoute = currentPath === '/' || currentPath === '';
  const isPlayRoute = currentPath === '/play' || currentPath.startsWith('/play/');
  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');

  // 1. LANDING PAGE ("/")
  if (isHomeRoute) {
    return <LandingPage onPlay={() => navigateTo('/play')} />;
  }

  // 2. PARTICIPANT ROUTE ("/play" and "/play/*")
  if (isPlayRoute) {
    return (
      <ParticipantProvider>
        <ParticipantPortal />
      </ParticipantProvider>
    );
  }

  // 3. ADMIN ROUTE ("/admin" and "/admin/*")
  if (isAdminRoute) {
    if (isCheckingAdmin) {
      return (
        <div className="min-h-screen bg-background text-on-surface flex items-center justify-center font-mono">
          <div className="bg-surface-container p-space-lg border-2 border-black arcade-shadow flex items-center gap-space-md">
            <span className="material-symbols-outlined text-[24px] text-primary-container animate-spin">
              progress_activity
            </span>
            <span className="font-headline-md text-headline-md uppercase font-bold text-primary">
              [ VERIFYING SECURITY CLEARANCE... ]
            </span>
          </div>
        </div>
      );
    }

    if (!isAdminVerified) {
      return (
        <AdminLoginView
          initialError={adminAuthError}
          onLoginSuccess={() => {
            setIsAdminVerified(true);
            setAdminAuthError(null);
            navigateTo('/admin');
          }}
          onNavigateToArena={() => navigateTo('/')}
        />
      );
    }

    // Authenticated & Verified Super Admin
    return (
      <ArenaProvider>
        <div className="relative min-h-screen bg-background text-on-surface">
          <Sidebar
            currentTab={currentAdminTab}
            onSelectTab={(tab) => {
              setCurrentAdminTab(tab);
              const subPath = tab === 'dashboard' ? '/admin' : `/admin/${tab}`;
              navigateTo(subPath);
            }}
          />
          <div className="pl-72">
            <Header onLogout={handleAdminLogout} />
            <main className="w-full pt-16 bg-surface min-h-screen">
              {currentAdminTab === 'dashboard' && <DashboardView />}
              {currentAdminTab === 'teams' && <TeamsView />}
              {currentAdminTab === 'questions-bank' && <QuestionsView />}
              {currentAdminTab === 'leaderboard' && <LeaderboardView />}
              {currentAdminTab === 'arena-controls' && <ControlsView />}
              {currentAdminTab === 'system-audit-log' && <AuditLogView />}
            </main>
          </div>
        </div>
      </ArenaProvider>
    );
  }

  // 4. UNKNOWN ROUTE -> PIXEL 404
  return <NotFoundPage onHome={() => navigateTo('/')} />;
}
