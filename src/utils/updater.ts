export interface AppUpdateInfo {
  version: string;
  versionCode: number;
  releaseDate: string;
  changelog: string[];
  windows: {
    url: string;
  };
  macos: {
    url: string;
  };
}

export const CURRENT_APP_VERSION = '1.0.0';

const MANIFEST_URL = 'https://raw.githubusercontent.com/PsyChoDev14/ZeroTrace-Desktop/main/version.json';

/**
 * Checks GitHub repository for new release versions
 */
export async function checkForAppUpdate(): Promise<{ hasUpdate: boolean; update?: AppUpdateInfo }> {
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-cache',
    });
    if (!res.ok) return { hasUpdate: false };

    const info: AppUpdateInfo = await res.json();
    if (info && info.version && isNewerVersion(info.version, CURRENT_APP_VERSION)) {
      return { hasUpdate: true, update: info };
    }
  } catch (e) {
    console.warn('[Updater] Failed to check for updates:', e);
  }
  return { hasUpdate: false };
}

/**
 * Semantic version comparison (e.g. 1.0.2 > 1.0.0)
 */
function isNewerVersion(remote: string, current: string): boolean {
  const clean = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const r = clean(remote);
  const c = clean(current);

  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rPart = r[i] || 0;
    const cPart = c[i] || 0;
    if (rPart > cPart) return true;
    if (rPart < cPart) return false;
  }
  return false;
}

/**
 * Open the download URL in browser or default handler
 */
export function openUpdateDownload(info: AppUpdateInfo) {
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent || '');
  const url = isMac ? info.macos.url : info.windows.url;

  if (typeof window !== 'undefined') {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
