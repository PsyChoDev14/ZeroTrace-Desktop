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

export const CURRENT_APP_VERSION = '1.3.1';

const GITHUB_API_LATEST = 'https://api.github.com/repos/PsyChoDev14/ZeroTrace-Desktop/releases/latest';
const MANIFEST_URL = 'https://raw.githubusercontent.com/PsyChoDev14/ZeroTrace-Desktop/main/version.json';

/**
 * Checks GitHub repository for new release versions in real-time
 */
export async function checkForAppUpdate(): Promise<{ hasUpdate: boolean; update?: AppUpdateInfo }> {
  // 1. Primary: Query GitHub Releases API directly (0-second edge cache, real-time)
  try {
    const res = await fetch(GITHUB_API_LATEST, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      cache: 'no-cache',
    });
    if (res.ok) {
      const release = await res.json();
      const tagName: string = release.tag_name || '';
      const version = tagName.replace(/^v/, '');

      if (version && isNewerVersion(version, CURRENT_APP_VERSION)) {
        const assets: Array<{ name: string; browser_download_url: string }> = release.assets || [];
        const winAsset = assets.find(a => a.name.endsWith('.exe')) || assets.find(a => a.name.endsWith('.msi'));
        const macAsset = assets.find(a => a.name.endsWith('.dmg'));

        const changelogLines = (release.body || '')
          .split('\n')
          .map((s: string) => s.replace(/^[-*]\s*/, '').trim())
          .filter((s: string) => s.length > 0 && !s.startsWith('#') && !s.startsWith('**Full'));

        return {
          hasUpdate: true,
          update: {
            version,
            versionCode: 1,
            releaseDate: release.published_at ? release.published_at.slice(0, 10) : 'Today',
            changelog: changelogLines.length > 0
              ? changelogLines.slice(0, 6)
              : ['Performance optimizations and bug fixes'],
            windows: {
              url: winAsset?.browser_download_url || `https://github.com/PsyChoDev14/ZeroTrace-Desktop/releases/download/v${version}/ZeroTrace_${version}_x64-setup.exe`
            },
            macos: {
              url: macAsset?.browser_download_url || `https://github.com/PsyChoDev14/ZeroTrace-Desktop/releases/download/v${version}/ZeroTrace_${version}_aarch64.dmg`
            }
          }
        };
      }
    }
  } catch (e) {
    console.warn('[Updater] Real-time GitHub API error, trying fallback:', e);
  }

  // 2. Fallback: Query static version.json
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-cache',
    });
    if (res.ok) {
      const info: AppUpdateInfo = await res.json();
      if (info && info.version && isNewerVersion(info.version, CURRENT_APP_VERSION)) {
        return { hasUpdate: true, update: info };
      }
    }
  } catch (e) {
    console.warn('[Updater] Fallback manifest error:', e);
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
