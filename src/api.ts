import type {
  AvailableExamsResponse,
  BuildStatus,
  Health,
  Lang,
  LevelDetailResponse,
  LevelsResponse,
  ListeningFilesResponse,
  ListeningImportResult,
  ListeningJobDetailResponse,
  ListeningJobsResponse,
  PdfBlock,
  PdfImportJobDetailResponse,
  PdfImportJobsResponse,
  PdfJobBlocksResponse,
  PdfUploadCompleteResponse,
  PdfUploadInitResponse,
  ReposResponse,
  SpeakingExamPartInput,
  SpeakingExamPartsResponse,
  SpeakingItem,
  SpeakingPlanDetailResponse,
  SpeakingPlanInput,
  SpeakingPlansResponse,
  SpeakingItemsResponse,
  SpeakingTemplatesResponse,
  TriggerResult,
  ValidateSpeakingItemResult,
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

async function requestBinary<T>(path: string, body: Blob, timeoutMs = 120_000): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, '分片上传超时')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
        ? result.error
        : `请求失败（HTTP ${response.status}）`
    throw new ApiError(response.status, message)
  }
  return result as T
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

  listeningJobDetail: (jobId: string, afterLogId?: number) =>
    request<ListeningJobDetailResponse>(
      `/api/listening/job/${encodeURIComponent(jobId)}${
        afterLogId && afterLogId > 0 ? `?after_log_id=${afterLogId}` : ''
      }`,
    ),

  listeningJobFiles: (jobId: string) =>
    request<ListeningFilesResponse>(`/api/listening/job/${encodeURIComponent(jobId)}/files`),

  listeningJobAnswers: (jobId: string) =>
    request<{ answers: { number: number; answer: string }[] }>(
      `/api/listening/job/${encodeURIComponent(jobId)}/answers`,
    ),

  updateListeningAnswers: (jobId: string, formData: FormData) =>
    requestForm<{ updated_count: number; answers: { number: number; answer: string }[] }>(
      `/api/listening/job/${encodeURIComponent(jobId)}/answers`,
      formData,
    ),

  updateListeningJobMeta: (jobId: string, payload: { name: string; level?: string }) =>
    request<{ ok: boolean }>(`/api/listening/job/${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteListeningJob: (jobId: string) =>
    request<{ ok: boolean }>(`/api/listening/job/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    }),

  // PDF 试卷导入：上传后由 RabbitMQ 异步解析
  uploadPdf: (formData: FormData) =>
    requestForm<{ job_id: string; status: string; error?: string }>('/api/pdf/import', formData),

  deletePdfJob: (jobId: string) =>
    request<{ ok: boolean }>(`/api/pdf/job/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    }),

  restorePdfJob: (jobId: string) =>
    request<{ ok: boolean }>(`/api/pdf/job/${encodeURIComponent(jobId)}/restore`, {
      method: 'POST',
    }),

  pdfJobs: (limit = 50, includeDeleted = false) =>
    request<PdfImportJobsResponse>(
      `/api/pdf/jobs?limit=${limit}${includeDeleted ? '&include_deleted=1' : ''}`,
    ),

  pdfJobDetail: (jobId: string, afterLogId?: number) =>
    request<PdfImportJobDetailResponse>(
      `/api/pdf/job/${encodeURIComponent(jobId)}${
        afterLogId && afterLogId > 0 ? `?after_log_id=${afterLogId}` : ''
      }`,
    ),

  // 分片上传：初始化 / 查进度 / 传分片 / 合并
  initPdfUpload: (payload: {
    filename: string
    size: number
    lang: string
    fingerprint: string
    md5: string
  }) =>
    request<PdfUploadInitResponse>('/api/pdf/upload/init', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  pdfUploadStatus: (uploadId: string) =>
    request<PdfUploadInitResponse>(`/api/pdf/upload/${encodeURIComponent(uploadId)}`),

  uploadPdfChunk: (uploadId: string, index: number, blob: Blob) =>
    requestBinary<{ received: number; total_chunks: number }>(
      `/api/pdf/upload/${encodeURIComponent(uploadId)}/chunk/${index}`,
      blob,
    ),

  completePdfUpload: (uploadId: string) =>
    request<PdfUploadCompleteResponse>(
      `/api/pdf/upload/${encodeURIComponent(uploadId)}/complete`,
      { method: 'POST' },
    ),

  pdfJobBlocks: (jobId: string) =>
    request<PdfJobBlocksResponse>(`/api/pdf/job/${encodeURIComponent(jobId)}/blocks`),

  savePdfBlocks: (jobId: string, blocks: PdfBlock[]) =>
    request<{ ok: boolean; summary: Record<string, unknown> }>(
      `/api/pdf/job/${encodeURIComponent(jobId)}/blocks`,
      { method: 'PUT', body: JSON.stringify({ blocks }) },
    ),

  retryPdfJob: (jobId: string) =>
    request<{ job_id: string; status: string }>(
      `/api/pdf/job/${encodeURIComponent(jobId)}/retry`,
      { method: 'POST' },
    ),

  // 关卡配置
  listLevels: () => request<LevelsResponse>('/api/levels'),

  createLevel: (payload: { name: string; lang: string; difficulty?: string; description?: string; sort_order?: number; active?: boolean }) =>
    request<{ id: number }>('/api/levels', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  levelDetail: (id: number) => request<LevelDetailResponse>(`/api/levels/${id}`),

  updateLevel: (
    id: number,
    payload: { name: string; difficulty?: string; description?: string; sort_order?: number; active?: boolean },
  ) =>
    request<{ ok: boolean }>(`/api/levels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteLevel: (id: number) =>
    request<{ ok: boolean }>(`/api/levels/${id}`, { method: 'DELETE' }),

  addLevelExam: (
    id: number,
    examId: string,
    itemType: 'listening' | 'speaking' | 'speaking_topic' | 'speaking_plan',
    sortOrder = 0,
  ) =>
    request<{ ok: boolean }>(`/api/levels/${id}/exams`, {
      method: 'POST',
      body: JSON.stringify({ exam_id: examId, item_type: itemType, sort_order: sortOrder }),
    }),

  removeLevelExam: (
    id: number,
    examId: string,
    itemType: 'listening' | 'speaking' | 'speaking_topic' | 'speaking_plan',
  ) =>
    request<{ ok: boolean }>(
      `/api/levels/${id}/exams/${encodeURIComponent(examId)}?item_type=${itemType}`,
      { method: 'DELETE' },
    ),

  availableExams: (id: number) =>
    request<AvailableExamsResponse>(`/api/levels/${id}/exams/available`),

  // 口语题库
  listSpeakingItems: (params?: { lang?: string; level?: string; activeOnly?: boolean }) => {
    const query = new URLSearchParams()
    if (params?.lang) query.set('lang', params.lang)
    if (params?.level) query.set('level', params.level)
    if (params?.activeOnly === false) query.set('active_only', 'false')
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<SpeakingItemsResponse>(`/api/speaking/items${suffix}`)
  },

  createSpeakingItem: (
    payload: Omit<SpeakingItem, 'item_key' | 'created_at' | 'updated_at'> & { item_key?: string },
  ) =>
    request<{ item_key: string }>('/api/speaking/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSpeakingItem: (
    key: string,
    payload: Omit<SpeakingItem, 'item_key' | 'created_at' | 'updated_at'>,
  ) =>
    request<{ ok: boolean }>(`/api/speaking/items/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteSpeakingItem: (key: string) =>
    request<{ ok: boolean }>(`/api/speaking/items/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }),

  // 口语考试部分配置（时长、追问、题卡等）
  listSpeakingExamParts: (params?: { lang?: string; level?: string; activeOnly?: boolean }) => {
    const query = new URLSearchParams()
    if (params?.lang) query.set('lang', params.lang)
    if (params?.level) query.set('level', params.level)
    if (params?.activeOnly === false) query.set('active_only', 'false')
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<SpeakingExamPartsResponse>(`/api/speaking/exam-parts${suffix}`)
  },

  createSpeakingExamPart: (payload: SpeakingExamPartInput) =>
    request<{ id: number }>('/api/speaking/exam-parts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSpeakingExamPart: (id: number, payload: SpeakingExamPartInput) =>
    request<{ ok: boolean }>(`/api/speaking/exam-parts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteSpeakingExamPart: (id: number) =>
    request<{ ok: boolean }>(`/api/speaking/exam-parts/${id}`, { method: 'DELETE' }),

  // 口语方案：同一难度下由若干口语题目组成的可复用方案
  listSpeakingPlans: (params?: { lang?: string; level?: string; activeOnly?: boolean }) => {
    const query = new URLSearchParams()
    if (params?.lang) query.set('lang', params.lang)
    if (params?.level) query.set('level', params.level)
    if (params?.activeOnly === false) query.set('active_only', 'false')
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request<SpeakingPlansResponse>(`/api/speaking/plans${suffix}`)
  },

  getSpeakingPlan: (id: number) =>
    request<SpeakingPlanDetailResponse>(`/api/speaking/plans/${id}`),

  createSpeakingPlan: (payload: SpeakingPlanInput) =>
    request<{ id: number }>('/api/speaking/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSpeakingPlan: (id: number, payload: SpeakingPlanInput) =>
    request<{ ok: boolean }>(`/api/speaking/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteSpeakingPlan: (id: number) =>
    request<{ ok: boolean }>(`/api/speaking/plans/${id}`, { method: 'DELETE' }),
  validateSpeakingItem: (payload: {
    lang?: string
    level: string
    topic: string
    prompt_de: string
    prompt_zh?: string
    expected_points?: string
    ref_answer?: string
    error_note?: string
  }) =>
    request<ValidateSpeakingItemResult>('/api/speaking/validate-item', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // 口语兜底话术
  listSpeakingTemplates: () =>
    request<SpeakingTemplatesResponse>('/api/speaking/templates'),

  listSpeakingTopics: () =>
    request<{ topics: string[] }>('/api/speaking/topics?lang=de'),

  createSpeakingTemplate: (payload: {
    exam_part: string
    role: string
    text: string
    topics?: string[]
    sort_order?: number
    active?: boolean
  }) =>
    request<{ id: number }>('/api/speaking/templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateSpeakingTemplate: (
    id: number,
    payload: {
      exam_part: string
      role: string
      text: string
      topics?: string[]
      sort_order?: number
      active?: boolean
    },
  ) =>
    request<{ ok: boolean }>(`/api/speaking/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteSpeakingTemplate: (id: number) =>
    request<{ ok: boolean }>(`/api/speaking/templates/${id}`, { method: 'DELETE' }),
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
