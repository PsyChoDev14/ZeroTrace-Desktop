import { useState, useEffect, useCallback } from 'react';
import { TitleBar } from './components/TitleBar';
import { Navigation, NavTab } from './components/Navigation';
import { HomeScreen } from './screens/HomeScreen';
import { ConfigsScreen } from './screens/ConfigsScreen';
import { StatisticsScreen } from './screens/StatisticsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LogsScreen } from './screens/LogsScreen';
import { AddConfigModal } from './components/AddConfigModal';
import { EditConfigModal } from './components/EditConfigModal';
import { ShareModal } from './components/ShareModal';
import { UpdateModal } from './components/UpdateModal';
import { AppSettings, DiagnosticLog, ProxyConfig, TrafficStats, VpnState } from './types';
import { api } from './utils/tauriBridge';
import { checkForAppUpdate, AppUpdateInfo } from './utils/updater';

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
    minimizeToTray: true,
    theme: 'dark',
  });
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ProxyConfig | null>(null);
  const [sharingConfig, setSharingConfig] = useState<ProxyConfig | null>(null);
  const [isPingingAll, setIsPingingAll] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<AppUpdateInfo | null>(null);

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

  const handleToggleConnect = useCallback(async () => {
    if (vpnState.status === 'connected' || vpnState.status === 'connecting') {
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
      setVpnState({ status: 'connecting' });
      if (!selectedId && configs.length > 0) {
        await api.connect(configs[0].id);
        api.getLogs().then(l => l && setLogs(l));
      } else if (selectedId) {
        await api.connect(selectedId);
        api.getLogs().then(l => l && setLogs(l));
      } else {
        setVpnState({ status: 'disconnected' });
        setIsAddOpen(true);
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

  return (
    <div className={`flex flex-col h-screen w-screen bg-zt-bg text-zt-text select-none overflow-hidden font-sans ${isLightMode ? 'theme-light' : ''}`}>
      {/* 1. Frameless Window Titlebar */}
      <TitleBar
        isConnected={vpnState.status === 'connected'}
        onOpenLogs={handleOpenLogs}
      />

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
      />
    </div>
  );
}
export default App;
