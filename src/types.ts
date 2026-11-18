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

export interface ValidateSpeakingItemIssue {
  text: string
  correction: string
  reason: string
}

export interface ValidateSpeakingItemResult {
  ok: boolean
  grammar_ok: boolean
  topic_fit: boolean
  issues: ValidateSpeakingItemIssue[]
  reason: string
  source: 'llm' | 'template' | 'error'
}

export interface LevelExam {
  exam_id: string
  item_type: 'listening' | 'speaking' | 'speaking_topic' | 'speaking_plan'
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
  item_type: 'listening' | 'speaking' | 'speaking_topic' | 'speaking_plan'
  name?: string | null
  lang: string
  source_url: string
  created_at: string
}

export interface AvailableExamsResponse {
  exams: AvailableExam[]
}

export interface SpeakingReplyTemplate {
  id: number
  lang: string
  exam_part: string
  role: string
  text: string
  /** 绑定的话题标签；空数组表示通用话术 */
  topics: string[]
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SpeakingTemplatesResponse {
  templates: SpeakingReplyTemplate[]
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

/** 口语考试辅助材料（题卡 / 思维导图 / 日程 / 关键词）。 */
export type ExamAid =
  | { kind: 'chips'; label: string; items: string[] }
  | { kind: 'cards'; label: string; cards: { title: string; hint: string }[] }
  | { kind: 'mindmap'; label: string; center: string; branches: string[] }
  | { kind: 'schedule'; label: string; groups: { name: string; slots: string[] }[] }

/** 口语考试的一个固定部分，对应 speaking_exam_parts 表。 */
export interface SpeakingExamPart {
  id: number
  lang: string
  level: string
  part_key: string
  title: string
  mode: string
  duration_sec: number
  max_followups: number
  role: string
  aid: ExamAid | null
  sort_order: number
  active: boolean
}

export type SpeakingExamPartInput = Omit<SpeakingExamPart, 'id'>

export interface SpeakingExamPartsResponse {
  parts: SpeakingExamPart[]
}

/** 同一难度下由若干口语题目组成的方案，关卡配置按方案引用。 */
export interface SpeakingPlan {
  id: number
  lang: string
  level: string
  name: string
  description: string
  active: boolean
  sort_order: number
  item_count: number
  created_at: string
  updated_at: string
}

export interface SpeakingPlanInput {
  lang: string
  level: string
  name: string
  description: string
  active: boolean
  sort_order: number
  item_keys: string[]
}

export interface SpeakingPlansResponse {
  plans: SpeakingPlan[]
}

export interface SpeakingPlanDetailResponse {
  plan: SpeakingPlan
  items: SpeakingItem[]
}

