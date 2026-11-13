const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('palautobc_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    localStorage.removeItem('palautobc_token');
    window.location.href = '/login';
    throw new ApiError('Unauthorized', 401);
  }

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data.error || 'Request failed', response.status, data.code);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<{ user: any }>('/auth/me'),
  changePassword: (passwords: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords),
    }),

  // Server
  getServerStatus: () => request<any>('/server/status'),
  startServer: () => request<any>('/server/start', { method: 'POST' }),
  stopServer: () => request<any>('/server/stop', { method: 'POST' }),
  restartServer: () => request<any>('/server/restart', { method: 'POST' }),

  // Backups
  getBackupHistory: () => request<any[]>('/backup/history'),
  getRemoteBackups: () => request<any[]>('/backup/remote'),
  runBackup: () => request<any>('/backup/run', { method: 'POST' }),
  unlockBackup: () => request<any>('/backup/unlock', { method: 'POST' }),
  getScheduler: () => request<any>('/backup/scheduler'),
  updateScheduler: (data: { time: string; enabled: boolean; timezone: string }) =>
    request<any>('/backup/scheduler', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Restore
  getRestoreHistory: () => request<any[]>('/restore/history'),
  restoreBackup: (filename: string) =>
    request<any>('/restore/execute', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    }),

  // Config
  getConfigSettings: () => request<{ raw: string; parsed: Record<string, any> }>('/config/settings'),
  updateConfigSettings: (payload: { settings?: Record<string, any>; rawContent?: string } | Record<string, any>) => {
    const body = 'settings' in payload || 'rawContent' in payload ? payload : { settings: payload };
    return request<{ success: boolean; message: string; requiresRestart: boolean }>('/config/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
  getConfigSnapshots: () => request<any[]>('/config/snapshots'),
  restoreConfigSnapshot: (id: string) =>
    request<{ success: boolean; message: string }>(`/config/snapshots/${id}/restore`, {
      method: 'POST',
    }),

  // Players
  getOnlinePlayers: () =>
    request<{ count: number; rconEnabled?: boolean; players: any[]; savedPlayers?: any[] }>('/players/online'),
  enableRcon: (password?: string) =>
    request<{ success: boolean; message: string }>('/players/enable-rcon', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  kickPlayer: (steamId: string) =>
    request<any>('/players/kick', {
      method: 'POST',
      body: JSON.stringify({ steamId }),
    }),
  banPlayer: (steamId: string) =>
    request<any>('/players/ban', {
      method: 'POST',
      body: JSON.stringify({ steamId }),
    }),
  broadcastMessage: (message: string) =>
    request<any>('/players/broadcast', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  saveWorld: () => request<any>('/players/save', { method: 'POST' }),

  // Console
  getConsoleLogs: (limit = 100) => request<any[]>(`/console/logs?limit=${limit}`),
  sendConsoleCommand: (command: string) =>
    request<{ output: string }>('/console/command', {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),

  // Files
  listFiles: (path = '') => request<any[]>(`/files/list?path=${encodeURIComponent(path)}`),
  readFile: (path: string) => request<{ content: string }>(`/files/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) =>
    request<{ success: boolean; message: string }>('/files/write', {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    }),
  renameFile: (path: string, newName: string) =>
    request<{ success: boolean; message: string }>('/files/rename', {
      method: 'POST',
      body: JSON.stringify({ path, newName }),
    }),
  deleteFile: (path: string) =>
    request<{ success: boolean; message: string }>('/files/delete', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  // Monitoring
  getMetrics: () => request<any>('/monitoring/metrics'),

  // Google Drive
  getGDriveStatus: () => request<any>('/gdrive/status'),
};

