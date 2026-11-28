// Pure display helpers (no React Native imports) so they run under node --test.

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
  closed: 'Closed',
  todo: 'To do',
  done: 'Done',
};

const platformLabels: Record<string, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  web: 'Web',
  other: 'Other',
};

function capitalize(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function formatStatus(value: string): string {
  return statusLabels[value] ?? capitalize(value.replaceAll('_', ' '));
}

export function formatPlatform(value: string): string {
  return platformLabels[value] ?? capitalize(value);
}

export function formatDate(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  return new Date(time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function relativeTime(iso: string, now = Date.now()): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const diff = now - time;
  if (diff < 0) return formatDate(iso);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return formatDate(iso);
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function deviceSummary(os: string, version?: string | number): string {
  const name = os === 'ios' ? 'iOS' : os === 'android' ? 'Android' : os === 'web' ? 'Web' : os;
  return [name, version].filter(value => value !== undefined && value !== '').join(' ');
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Returns an https URL that is safe to hand to the OS, or throws a user-facing error. */
export function safeBuildUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('This build does not have a valid link.');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('This build link is not valid.');
  return parsed.href;
}
