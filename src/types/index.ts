export type ProxyProtocol = 'VLESS' | 'VMESS' | 'TROJAN' | 'SHADOWSOCKS' | 'CUSTOM_JSON';

export interface ProxyConfig {
  id: string;
  name: string;
  protocol: ProxyProtocol;
  server: string;
  port: number;
  uuid?: string;           // UUID or Password
  security?: string;       // reality, tls, none
  network?: string;        // tcp, ws, grpc, httpupgrade
  sni?: string;            // SNI / Server Name / Bug Host
  path?: string;           // WS or HTTP path
  flow?: string;           // xtls-rprx-vision
  publicKey?: string;      // Reality pbk
  shortId?: string;        // Reality sid
  fingerprint?: string;    // chrome, firefox, etc.
  serviceName?: string;    // gRPC service name
  alterId?: number;        // VMess alterId
  cipher?: string;         // Shadowsocks method or VMess cipher
  rawConfig?: string;      // Original URI or custom JSON
  pingMs: number;          // Latency in ms (-1 = untested)
  createdAt: number;
}

export type VpnStatusType = 'disconnected' | 'connecting' | 'connected' | 'stopping' | 'error';

export interface VpnState {
  status: VpnStatusType;
  serverName?: string;
  serverAddress?: string;
  connectedAt?: number;
  errorMessage?: string;
}

export type DpiBypassMode = 'OFF' | 'SMART_FRAGMENT' | 'DEEP_STEALTH' | 'CUSTOM';

export interface DnsProfile {
  id: string;
  name: string;
  primaryIp: string;
  secondaryIp: string;
  description: string;
  categoryTag: string;
  isAdBlocker?: boolean;
  isMalwareBlocker?: boolean;
}

export interface AppSettings {
  primaryDns: string;
  bypassLan: boolean;
  sriLankaSniTweak: string;
  dpiBypassMode: DpiBypassMode;
  utlsFingerprint: string;
  muxEnabled: boolean;
  fragmentPackets: string;
  fragmentLength: string;
  fragmentInterval: string;
  killSwitch: boolean;
  autoConnect: boolean;
  minimizeToTray: boolean;
}

export interface TrafficStats {
  downloadSpeed: number; // bytes/sec
  uploadSpeed: number;   // bytes/sec
  totalDownloaded: number; // total bytes
  totalUploaded: number;   // total bytes
  uptimeSeconds: number;
}

export interface DiagnosticLog {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  tag: string;
  message: string;
}
