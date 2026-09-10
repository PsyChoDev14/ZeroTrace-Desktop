export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  if (bytesPerSec > 0) {
    return `${Math.round(bytesPerSec)} B/s`;
  }
  return '0 KB/s';
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatPing(pingMs: number): { text: string; colorClass: string; dotClass: string } {
  if (pingMs < 0) {
    return { text: '-- ms', colorClass: 'text-zt-text-faint', dotClass: 'bg-zt-text-faint' };
  }
  if (pingMs <= 100) {
    return { text: `${pingMs}ms`, colorClass: 'text-zt-success', dotClass: 'bg-zt-success' };
  }
  if (pingMs <= 250) {
    return { text: `${pingMs}ms`, colorClass: 'text-zt-warn', dotClass: 'bg-zt-warn' };
  }
  return { text: `${pingMs}ms`, colorClass: 'text-zt-danger', dotClass: 'bg-zt-danger' };
}
