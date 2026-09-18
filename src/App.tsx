import { useState, useEffect, useCallback, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Navigation, NavTab } from './components/Navigation';
import { HomeScreen } from './screens/HomeScreen';
import { ConfigsScreen } from './screens/ConfigsScreen';
import { StatisticsScreen } from './screens/StatisticsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LogsScreen } from './screens/LogsScreen';
import { AccountScreen } from './screens/AccountScreen';
import { LoginScreen } from './screens/LoginScreen';
import { AddConfigModal } from './components/AddConfigModal';
import { EditConfigModal } from './components/EditConfigModal';
import { ShareModal } from './components/ShareModal';
import { UpdateModal } from './components/UpdateModal';
import { AppSettings, DiagnosticLog, ProxyConfig, SubscriptionInfo, TrafficStats, UserProfile, VpnState } from './types';
import { api, isTauri } from './utils/tauriBridge';
import { checkForAppUpdate, AppUpdateInfo } from './utils/updater';
import {
  PendingLogin,
  SessionExpiredError,
  completeLogin,
  fetchSubscriptions,
  fetchUserProfile,
  hasStoredSession,
  logout as authLogout,
  startLogin,
} from './utils/authApi';

const OFFLINE_KEY = 'zt.offlineChoice';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [previousTab, setPreviousTab] = useState<NavTab>('home');
  const [vpnState, setVpnState] = useState<VpnState>({ status: 'disconnected' });
  const [configs, setConfigs] = useState<ProxyConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trafficStats, setTrafficStats] = useState<TrafficStats>({
    downloadSpeed: 0,
    uploadSpeed: 0,
    totalDownloaded: 0,
    totalUploaded: 0,
    uptimeSeconds: 0,
  });
  const [settings, setSettings] = useState<AppSettings>({
    primaryDns: '94.140.14.14',
    bypassLan: true,
    sriLankaSniTweak: '',
    dpiBypassMode: 'SMART_FRAGMENT',
    utlsFingerprint: 'chrome',
    muxEnabled: false,
    fragmentPackets: 'tlshello',
    fragmentLength: '10-30',
    fragmentInterval: '10-20',
    killSwitch: true,
    autoConnect: false,
    launchAtStartup: false,
    minimizeToTray: true,
    theme: 'dark',
  });
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);

  // Account / OAuth login state
  const [account, setAccount] = useState<UserProfile | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const pendingLoginRef = useRef<PendingLogin | null>(null);
  // null until the keychain has been checked, so the login page doesn't flash for signed-in users.
  const [sessionPresent, setSessionPresent] = useState<boolean | null>(null);
  const [offlineChoice, setOfflineChoice] = useState<boolean>(() => {
    try { return localStorage.getItem(OFFLINE_KEY) === '1'; } catch { return false; }
  });

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ProxyConfig | null>(null);
  const [sharingConfig, setSharingConfig] = useState<ProxyConfig | null>(null);
  const [isPingingAll, setIsPingingAll] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null);

  // Startup auto-connect guard
  const autoConnectFiredRef = useRef(false);

  // Check for updates on startup (silent check after 2.5s)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForAppUpdate().then(res => {
        if (res.hasUpdate && res.update) {
          setAvailableUpdate(res.update);
        }
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // System appearance listener for automatic dark/light mode switching
  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isLightMode = settings.theme === 'light' || (settings.theme === 'system' && !systemDark);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('theme-light', isLightMode);
    }
  }, [isLightMode]);

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const [loadedConfigs, loadedSelectedId, loadedState, loadedSettings, loadedLogs] = await Promise.all([
          api.getConfigs(),
          api.getSelectedConfigId(),
          api.getState(),
          api.getSettings(),
          api.getLogs(),
        ]);
        if (loadedConfigs) setConfigs(loadedConfigs);
        if (loadedSelectedId) setSelectedId(loadedSelectedId);
        if (loadedState) setVpnState(loadedState);
        if (loadedSettings) setSettings(loadedSettings);
        if (loadedLogs) setLogs(loadedLogs);

        // Auto-connect on startup with last connected config if enabled in settings
        if (loadedSettings?.autoConnect && !autoConnectFiredRef.current) {
          autoConnectFiredRef.current = true;
          if (loadedState?.status === 'disconnected') {
            const targetId = loadedSelectedId || (loadedConfigs && loadedConfigs.length > 0 ? loadedConfigs[0].id : null);
            if (targetId) {
              console.log('[AutoConnect] Auto-connecting to last active configuration:', targetId);
              setTimeout(() => {
                api.connect(targetId).catch(err => {
                  console.error('[AutoConnect] Auto-connection on launch failed:', err);
                });
              }, 400);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }
    loadData();
  }, []);

  // Battery-aware adaptive polling loop:
  // - Connected: 1000ms (live throughput)
  // - Connecting / Stopping: 400ms (fast handshake response)
  // - Disconnected / Idle: 2500ms (saves CPU & timer interrupts)
  // - Background / Minimized (document.hidden): 5000ms (macOS App Nap friendly)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;

      let nextDelay = 2500;

      try {
        const isHidden = typeof document !== 'undefined' && document.hidden;

        const state = await api.getState();
        if (!isMounted) return;

        // Strict state diffing — skips React re-render if state hasn't changed
        setVpnState(prev => {
          if (
            prev.status === state.status &&
            prev.serverName === state.serverName &&
            prev.serverAddress === state.serverAddress &&
            prev.errorMessage === state.errorMessage
          ) {
            return prev;
          }
          return state;
        });

        if (state.status === 'connected') {
          nextDelay = isHidden ? 4000 : 1000;
          const stats = await api.getTrafficStats();
          if (stats && isMounted) {
            setTrafficStats(prev => {
              if (
                prev.downloadSpeed === stats.downloadSpeed &&
                prev.uploadSpeed === stats.uploadSpeed &&
                prev.uptimeSeconds === stats.uptimeSeconds
              ) {
                return prev;
              }
              return stats;
            });
          }
        } else if (state.status === 'connecting' || state.status === 'stopping') {
          nextDelay = 400;
          setTrafficStats(prev => {
            if (prev.downloadSpeed === 0 && prev.uploadSpeed === 0) return prev;
            return { ...prev, downloadSpeed: 0, uploadSpeed: 0 };
          });
        } else {
          nextDelay = isHidden ? 5000 : 2500;
          setTrafficStats(prev => {
            if (prev.downloadSpeed === 0 && prev.uploadSpeed === 0 && prev.uptimeSeconds === 0) return prev;
            return { ...prev, downloadSpeed: 0, uploadSpeed: 0, uptimeSeconds: 0 };
          });
        }
      } catch (err) {
        console.error('State poll error:', err);
      } finally {
        if (isMounted) {
          timeoutId = setTimeout(poll, nextDelay);
        }
      }
    };

    poll();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const selectedConfig = configs.find(c => c.id === selectedId) || null;

  const isConnectingRef = useRef(false);

  const handleToggleConnect = useCallback(async () => {
    if (isConnectingRef.current || vpnState.status === 'stopping') {
      return;
    }

    if (vpnState.status === 'connected') {
      // Optimistic instant response: immediate stopping state & reset throughput
      setVpnState({ status: 'stopping' });
      setTrafficStats(prev => ({
        ...prev,
        downloadSpeed: 0,
        uploadSpeed: 0,
      }));
      try {
        await api.disconnect();
      } catch (e) {
        console.error('Failed to disconnect cleanly:', e);
      }
      setVpnState({
        status: 'disconnected',
        serverName: undefined,
        serverAddress: undefined,
        connectedAt: undefined,
        errorMessage: undefined,
      });
      setTrafficStats({
        downloadSpeed: 0,
        uploadSpeed: 0,
        totalDownloaded: 0,
        totalUploaded: 0,
        uptimeSeconds: 0,
      });
      api.getLogs().then(l => l && setLogs(l));
    } else {
      isConnectingRef.current = true;
      setVpnState({ status: 'connecting', errorMessage: undefined });
      try {
        if (!selectedId && configs.length > 0) {
          setSelectedId(configs[0].id);
          await api.connect(configs[0].id);
        } else if (selectedId) {
          await api.connect(selectedId);
        } else {
          setVpnState({ status: 'disconnected', errorMessage: undefined });
          setIsAddOpen(true);
        }
      } catch (err) {
        console.error('Connection failed:', err);
        setVpnState({
          status: 'disconnected',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      } finally {
        isConnectingRef.current = false;
        api.getState().then(s => s && setVpnState(s));
        api.getLogs().then(l => l && setLogs(l));
      }
    }
  }, [vpnState.status, selectedId, configs]);

  const handleSelectConfig = useCallback(async (id: string) => {
    setSelectedId(id);
    await api.selectConfig(id);
  }, []);

  const handlePing = useCallback(async (id: string) => {
    const pingMs = await api.pingConfig(id);
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, pingMs } : c));
  }, []);

  const handlePingAll = useCallback(async () => {
    setIsPingingAll(true);
    try {
      const updated = await api.pingAll();
      if (updated) setConfigs(updated);
    } finally {
      setIsPingingAll(false);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await api.deleteConfig(id);
    setConfigs(prev => prev.filter(c => c.id !== id));
    setSelectedId(prev => (prev === id ? null : prev));
  }, []);

  const handleSaveSettings = useCallback(async (updated: AppSettings) => {
    setSettings(updated);
    await api.saveSettings(updated);
  }, []);

  const handleClearLogs = useCallback(async () => {
    await api.clearLogs();
    setLogs([]);
  }, []);

  const handleOpenLogs = useCallback(async () => {
    try {
      const freshLogs = await api.getLogs();
      if (freshLogs) setLogs(freshLogs);
    } catch (e) {
      console.error('Failed to load logs on open:', e);
    }
    setCurrentTab(prev => {
      if (prev !== 'logs') {
        setPreviousTab(prev);
        return 'logs';
      }
      return prev;
    });
  }, []);

  // Fetches the account profile + subscriptions, and upserts synced subscriptions into
  // the existing configs list (matched by subscriptionId so re-syncing updates in place
  // instead of duplicating). Manually-added configs are never touched by this.
  const refreshAccount = useCallback(async () => {
    setAccountLoading(true);
    setAccountError(null);
    try {
      // Read the canonical config list straight from storage (not React state) so a sync
      // that races the startup config load still matches existing synced entries correctly.
      const [profile, subs, currentConfigs] = await Promise.all([
        fetchUserProfile(),
        fetchSubscriptions(),
        api.getConfigs(),
      ]);
      setAccount(profile);
      setSessionPresent(true);
      setSubscriptions(subs);

      // Only active subscriptions become server configs.
      const activeSubs = subs.filter(s => !s.expiry.isExpired && s.status.toLowerCase() !== 'expired');
      const activeIds = new Set(activeSubs.map(s => s.id));

      // Make the synced set exactly match this account's active subscriptions: drops another
      // account's configs, expired plans, and cancelled plans. Manual configs (no subscriptionId)
      // are never touched, and sign-out doesn't run this, so signing out leaves configs in place.
      for (const cfg of currentConfigs || []) {
        if (cfg.subscriptionId != null && !activeIds.has(cfg.subscriptionId)) {
          await api.deleteConfig(cfg.id);
        }
      }

      for (const sub of activeSubs) {
        const parsed = await api.parseConfig(sub.configUrl);
        if (!parsed) continue;
        const existing = (currentConfigs || []).find(c => c.subscriptionId === sub.id);
        await api.saveConfig({
          ...parsed,
          id: existing?.id ?? parsed.id,
          name: sub.packageName || parsed.name,
          pingMs: existing?.pingMs ?? parsed.pingMs,
          subscriptionId: sub.id,
        });
      }
      const [freshConfigs, freshSelectedId] = await Promise.all([api.getConfigs(), api.getSelectedConfigId()]);
      if (freshConfigs) setConfigs(freshConfigs);
      setSelectedId(freshSelectedId ?? null);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setAccount(null);
        setSubscriptions([]);
        setSessionPresent(false);
        setAccountError(err.message);
      } else {
        setAccountError(err instanceof Error ? err.message : 'Failed to load account');
      }
    } finally {
      setAccountLoading(false);
    }
  }, []);

  const handleLogin = useCallback(async () => {
    setAccountError(null);
    setAccountLoading(true);
    try {
      pendingLoginRef.current = await startLogin();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Could not open sign-in page');
      setAccountLoading(false);
    }
  }, []);

  const handleCancelLogin = useCallback(() => {
    pendingLoginRef.current = null;
    setAccountLoading(false);
    setAccountError(null);
  }, []);

  const handleContinueOffline = useCallback(() => {
    try { localStorage.setItem(OFFLINE_KEY, '1'); } catch { /* preference just won't persist */ }
    setOfflineChoice(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await authLogout();
    setAccount(null);
    setSubscriptions([]);
    setSessionPresent(false);
    // Signing out lands back in the app with its configs, not on the login page.
    handleContinueOffline();
  }, [handleContinueOffline]);

  // Completes the PKCE flow once the OS hands back the netchvpn://auth/callback deep link.
  const handleDeepLinkUrls = useCallback(async (urls: string[]) => {
    const raw = urls[0];
    if (!raw) return;
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return;
    }
    if (parsed.protocol !== 'netchvpn:') return;

    const code = parsed.searchParams.get('code');
    const state = parsed.searchParams.get('state');
    const pending = pendingLoginRef.current;
    if (!code || !state || !pending || state !== pending.state) {
      console.error('[Auth] Ignoring deep link callback: missing or mismatched state');
      setAccountError('Sign-in failed — please try again.');
      setAccountLoading(false);
      return;
    }
    pendingLoginRef.current = null;
    try {
      await completeLogin(code, pending.verifier);
      setSessionPresent(true);
      await refreshAccount();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Sign-in failed');
      setAccountLoading(false);
    }
  }, [refreshAccount]);

  // Global deep-link listener (works regardless of which tab is active) + resume any
  // already-signed-in session on startup.
  useEffect(() => {
    hasStoredSession().then(has => {
      setSessionPresent(has);
      if (has) refreshAccount();
    }).catch(() => setSessionPresent(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl, getCurrent }) => {
      getCurrent().then(urls => {
        if (urls && urls.length > 0) handleDeepLinkUrls(urls);
      }).catch(() => {});

      onOpenUrl(handleDeepLinkUrls).then(fn => {
        unlisten = fn;
      }).catch(err => {
        console.warn('[Auth] Could not bind deep link listener:', err);
      });
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [handleDeepLinkUrls]);

  // Launch gate: shown until signed in or the user picks "Use this device offline".
  const showLoginGate = sessionPresent === false && !account && !offlineChoice;

  return (
    <div className={`flex flex-col h-screen w-screen bg-zt-bg text-zt-text select-none overflow-hidden font-sans theme-animated ${isLightMode ? 'theme-light' : ''}`}>
      {/* 1. Frameless Window Titlebar */}
      <TitleBar
        isConnected={vpnState.status === 'connected'}
        onOpenLogs={handleOpenLogs}
        onOpenAccount={showLoginGate ? undefined : () => {
          setPreviousTab(currentTab);
          setCurrentTab('account');
        }}
        accountActive={currentTab === 'account'}
        accountName={account?.name}
        avatarUrl={account?.avatarUrl}
      />

      {showLoginGate ? (
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <LoginScreen
            isLightMode={isLightMode}
            loading={accountLoading}
            error={accountError}
            onLogin={handleLogin}
            onCancel={handleCancelLogin}
            onOffline={handleContinueOffline}
            showFooter
          />
        </main>
      ) : (
      <>
      {/* 2. Main Viewport */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div key={currentTab} className="flex-1 flex flex-col overflow-hidden animate-screen-enter">
          {currentTab === 'home' && (
            <HomeScreen
              vpnState={vpnState}
              selectedConfig={selectedConfig}
              trafficStats={trafficStats}
              onToggleConnect={handleToggleConnect}
              onOpenAddModal={() => setIsAddOpen(true)}
              onNavigateToConfigs={() => setCurrentTab('servers')}
              onPing={handlePing}
              isLightMode={isLightMode}
            />
          )}

          {currentTab === 'servers' && (
            <ConfigsScreen
              configs={configs}
              selectedId={selectedId}
              onSelect={handleSelectConfig}
              onPing={handlePing}
              onPingAll={handlePingAll}
              onOpenAddModal={() => setIsAddOpen(true)}
              onEdit={cfg => setEditingConfig(cfg)}
              onShare={cfg => setSharingConfig(cfg)}
              onDelete={handleDelete}
              isPingingAll={isPingingAll}
            />
          )}

          {currentTab === 'statistics' && (
            <StatisticsScreen
              vpnState={vpnState}
              selectedConfig={selectedConfig}
              trafficStats={trafficStats}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsScreen
              settings={settings}
              onSave={handleSaveSettings}
              onOpenLogs={handleOpenLogs}
              onShowUpdateModal={info => setAvailableUpdate(info)}
            />
          )}

          {currentTab === 'logs' && (
            <LogsScreen
              logs={logs}
              onClear={handleClearLogs}
              onBack={() => setCurrentTab(previousTab)}
            />
          )}

          {currentTab === 'account' && (
            <AccountScreen
              account={account}
              subscriptions={subscriptions}
              loading={accountLoading}
              error={accountError}
              isLightMode={isLightMode}
              onLogin={handleLogin}
              onCancel={handleCancelLogin}
              onLogout={handleLogout}
              onRefresh={refreshAccount}
            />
          )}
        </div>
      </main>

      {/* 3. Floating iOS Liquid Glass Bottom Navigation Island */}
      <Navigation
        currentTab={currentTab}
        onTabChange={tab => {
          setPreviousTab(currentTab);
          setCurrentTab(tab);
        }}
        serverCount={configs.length}
        onOpenAddModal={() => setIsAddOpen(true)}
      />
      </>
      )}

      {/* Modals */}
      <AddConfigModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdded={newCfg => {
          setConfigs(prev => [newCfg, ...prev]);
          setSelectedId(newCfg.id);
        }}
      />

      <EditConfigModal
        config={editingConfig}
        isOpen={editingConfig !== null}
        onClose={() => setEditingConfig(null)}
        onSaved={updated => {
          setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
        }}
      />

      <ShareModal
        config={sharingConfig}
        isOpen={sharingConfig !== null}
        onClose={() => setSharingConfig(null)}
      />

      <UpdateModal
        isOpen={availableUpdate !== null}
        updateInfo={availableUpdate}
        onClose={() => setAvailableUpdate(null)}
        isLightMode={isLightMode}
      />
    </div>
  );
}
export default App;
