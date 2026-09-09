import { AppSettings, DiagnosticLog, ProxyConfig, TrafficStats, VpnState } from '../types';

// Check if running inside Tauri webview
export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Fallback in-memory storage for web browser testing/preview
let mockConfigs: ProxyConfig[] = [];

let mockSelectedId: string | null = null;
let mockVpnState: VpnState = { status: 'disconnected' };
let mockSettings: AppSettings = {
  primaryDns: '94.140.14.14', // AdGuard
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
};

let mockLogs: DiagnosticLog[] = [
  { timestamp: new Date().toISOString(), level: 'INFO', tag: 'ZeroTrace-Core', message: 'Engine initialized successfully.' },
  { timestamp: new Date().toISOString(), level: 'DEBUG', tag: 'WintunManager', message: 'Wintun driver probe ready (L3 Virtual TUN).' },
];

async function invokeTauri<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke(cmd, args);
  }
  return mockInvoke(cmd, args) as Promise<T>;
}

async function mockInvoke(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  switch (cmd) {
    case 'get_state':
      return mockVpnState;
    case 'connect': {
      mockVpnState = { status: 'connecting' };
      setTimeout(() => {
        const active = mockConfigs.find(c => c.id === (args.configId || mockSelectedId));
        mockVpnState = {
          status: 'connected',
          serverName: active?.name || 'ZeroTrace Node',
          serverAddress: active ? `${active.server}:${active.port}` : '10.233.233.2',
          connectedAt: Date.now()
        };
      }, 1000);
      return true;
    }
    case 'disconnect': {
      mockVpnState = { status: 'stopping' };
      setTimeout(() => {
        mockVpnState = { status: 'disconnected' };
      }, 600);
      return true;
    }
    case 'get_configs':
      return mockConfigs;
    case 'get_selected_config_id':
      return mockSelectedId;
    case 'select_config':
      mockSelectedId = args.id as string;
      return true;
    case 'save_config': {
      const cfg = args.config as ProxyConfig;
      const idx = mockConfigs.findIndex(c => c.id === cfg.id);
      if (idx >= 0) {
        mockConfigs[idx] = cfg;
      } else {
        mockConfigs.unshift(cfg);
      }
      return true;
    }
    case 'delete_config': {
      const id = args.id as string;
      mockConfigs = mockConfigs.filter(c => c.id !== id);
      if (mockSelectedId === id) mockSelectedId = mockConfigs[0]?.id || null;
      return true;
    }
    case 'ping_config': {
      const id = args.id as string;
      const idx = mockConfigs.findIndex(c => c.id === id);
      if (idx >= 0) {
        const ping = Math.floor(35 + Math.random() * 80);
        mockConfigs[idx].pingMs = ping;
        return ping;
      }
      return -1;
    }
    case 'ping_all': {
      for (const c of mockConfigs) {
        c.pingMs = Math.floor(35 + Math.random() * 95);
      }
      return mockConfigs;
    }
    case 'get_settings':
      return mockSettings;
    case 'save_settings':
      mockSettings = { ...mockSettings, ...(args.settings as AppSettings) };
      return true;
    case 'get_logs':
      return mockLogs;
    case 'clear_logs':
      mockLogs = [];
      return true;
    case 'get_traffic_stats': {
      const isConn = mockVpnState.status === 'connected';
      return {
        downloadSpeed: isConn ? Math.floor(1800000 + Math.random() * 800000) : 0,
        uploadSpeed: isConn ? Math.floor(320000 + Math.random() * 120000) : 0,
        totalDownloaded: 145000000,
        totalUploaded: 28000000,
        uptimeSeconds: mockVpnState.connectedAt ? Math.floor((Date.now() - mockVpnState.connectedAt) / 1000) : 0,
      } as TrafficStats;
    }
    default:
      console.warn(`[mockInvoke] Unknown command: ${cmd}`, args);
      return null;
  }
}

export const api = {
  getState: () => invokeTauri<VpnState>('get_state'),
  connect: (configId?: string) => invokeTauri<boolean>('connect', { configId }),
  disconnect: () => invokeTauri<boolean>('disconnect'),
  getConfigs: () => invokeTauri<ProxyConfig[]>('get_configs'),
  getSelectedConfigId: () => invokeTauri<string | null>('get_selected_config_id'),
  selectConfig: (id: string) => invokeTauri<boolean>('select_config', { id }),
  saveConfig: (config: ProxyConfig) => invokeTauri<boolean>('save_config', { config }),
  deleteConfig: (id: string) => invokeTauri<boolean>('delete_config', { id }),
  pingConfig: (id: string) => invokeTauri<number>('ping_config', { id }),
  pingAll: () => invokeTauri<ProxyConfig[]>('ping_all'),
  parseConfig: (raw: string) => invokeTauri<ProxyConfig | null>('parse_config', { raw }),
  getSettings: () => invokeTauri<AppSettings>('get_settings'),
  saveSettings: (settings: AppSettings) => invokeTauri<boolean>('save_settings', { settings }),
  getLogs: () => invokeTauri<DiagnosticLog[]>('get_logs'),
  clearLogs: () => invokeTauri<boolean>('clear_logs'),
  getTrafficStats: () => invokeTauri<TrafficStats>('get_traffic_stats'),
};
