export type Lang = 'de' | 'en' | 'ja'

export interface LangOption {
  value: Lang
  label: string
}

export const LANGS: LangOption[] = [
  { value: 'de', label: '德语' },
  { value: 'en', label: '英语' },
  { value: 'ja', label: '日语' },
]

export function langLabel(lang: string): string {
  return LANGS.find((item) => item.value === lang)?.label ?? lang
}

export interface Health {
  status: string
  available_mb: number
  build_busy: boolean
  postgres: string
}

export interface Artifact {
  url: string
  md5: string
}

export interface VersionInfo {
  lang: string
  version: string
  ground_truth: Artifact
  vector_snapshot: Artifact
  created_at: string
}

export interface TriggerResult {
  lang: string
  version: string
  status: string
}

export interface BuildLog {
  stage: string
  level: string
  message: string
  created_at: string
}

export interface BuildStatus {
  version: string
  lang: string
  status: string
  db_url: string
  vector_snapshot_url: string
  db_md5: string
  vector_md5: string
  created_at: string
  logs: BuildLog[]
}

export interface RecentBuild {
  version: string
  lang: string
  createdAt: string
}

export interface RepoStatus {
  lang: string
  repo_url: string
  latest_commit: string
  latest_commit_short: string
  last_build_version: string | null
  last_build_commit: string
  last_build_at?: string
  pending: boolean
  error?: string
}

export interface ReposResponse {
  repos: RepoStatus[]
}

export interface ListeningJob {
  job_id: string
  exam_id: string
  name?: string | null
  lang: string
  level: string
  source_url: string
  status: string // pending / running / built / failed
  manifest_path: string
  log_path: string
  error_msg: string
  last_log_at?: string | null
  created_at: string
  updated_at: string
}

export interface ListeningJobLog {
  log_id: number
  stage: string
  level: string
  message: string
  created_at: string
}

export interface ListeningImportResult {
  job_id: string
  exam_id: string
  lang: string
  status: string
}

export interface ListeningJobsResponse {
  jobs: ListeningJob[]
}

export interface ListeningJobDetailResponse {
  job: ListeningJob
  logs: ListeningJobLog[]
}

export interface ListeningFile {
  path: string
  name: string
  size: number
}

export interface ListeningFilesResponse {
  exam_id: string
  files: ListeningFile[]
}

// ---------------------------------------------------------------------------
// 关卡配置
// ---------------------------------------------------------------------------

export interface Level {
  id: number
  name: string
  lang: string
  difficulty: string
  active: boolean
  description: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface LevelExam {
  exam_id: string
  item_type: 'listening' | 'speaking'
  name?: string
  lang: string
  source_url: string
  sort_order: number
  created_at: string
}

export interface LevelDetailResponse {
  level: Level
  exams: LevelExam[]
}

export interface LevelsResponse {
  levels: Level[]
}

export interface AvailableExam {
  exam_id: string
  item_type: 'listening' | 'speaking'
  name?: string | null
  lang: string
  source_url: string
  created_at: string
}

export interface AvailableExamsResponse {
  exams: AvailableExam[]
}

// ---------------------------------------------------------------------------
// 口语题库
// ---------------------------------------------------------------------------

export interface SpeakingItem {
  item_key: string
  lang: string
  level: string
  exam_part: string
  topic: string
  role: string
  prompt_de: string
  prompt_zh: string
  expected_points: string
  ref_answer: string
  error_note: string
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface SpeakingItemsResponse {
  items: SpeakingItem[]
}
