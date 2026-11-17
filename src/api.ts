import type {
  BuildStatus,
  Health,
  Lang,
  ListeningFilesResponse,
  ListeningImportResult,
  ListeningJobDetailResponse,
  ListeningJobsResponse,
  ReposResponse,
  TriggerResult,
  VersionInfo,
} from './types'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `请求失败（HTTP ${response.status}）`
    throw new ApiError(response.status, message)
  }
  return body as T
}

async function requestForm<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
    // 注意：不要手动设 Content-Type，浏览器会自动加 boundary
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `请求失败（HTTP ${response.status}）`
    throw new ApiError(response.status, message)
  }
  return body as T
}

export const api = {
  health: () => request<Health>('/api/health'),

  version: (lang: Lang) => request<VersionInfo>(`/api/version?lang=${lang}`),

  triggerBuild: (payload: { lang: Lang; version?: string }) =>
    request<TriggerResult>('/api/build/trigger', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  buildStatus: (version: string) =>
    request<BuildStatus>(`/api/build/status?version=${encodeURIComponent(version)}`),

  repos: () => request<ReposResponse>('/api/repos'),

  importListening: (formData: FormData) =>
    requestForm<ListeningImportResult>('/api/listening/import', formData),

  listeningJobs: (limit = 50) =>
    request<ListeningJobsResponse>(`/api/listening/jobs?limit=${limit}`),

  listeningJobDetail: (jobId: string) =>
    request<ListeningJobDetailResponse>(`/api/listening/job/${encodeURIComponent(jobId)}`),

  listeningJobFiles: (jobId: string) =>
    request<ListeningFilesResponse>(`/api/listening/job/${encodeURIComponent(jobId)}/files`),
}

/** 拼出可直接用于 <a download> 的完整地址（含 VITE_API_BASE 前缀）。 */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function formatTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

export function isDownloadable(url: string): boolean {
  return /^https?:\/\//.test(url)
}
