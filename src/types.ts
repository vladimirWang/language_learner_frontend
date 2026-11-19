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

export interface ListeningGenerateResult {
  job_id: string
  exam_id: string
  title: string
  speaker_count: number
  dialogue_lines: number
  question_count: number
  vocabulary_used: string[]
}

export interface ListeningGenerateAccepted {
  job_id: string
  exam_id: string
  status: 'pending'
  message: string
  sse_endpoint: string
  detail_endpoint: string
}

export interface SystemNotification {
  id: number
  job_id: string
  event_type: 'progress' | 'success' | 'error' | 'info'
  title: string
  message: string
  payload?: Record<string, unknown>
  created_at: string
  read_at?: string | null
}

export interface NotificationsResponse {
  notifications: SystemNotification[]
  unread_count: number
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
  /** 该题能自然引出的语法点 key，用于方案语法要求承载校验 */
  target_grammar?: string[]
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

/** 方案级语法要求；整场任意回答达成即可，hint_parts 仅用于提示。 */
export interface GrammarRequirement {
  key: string
  label: string
  source_path: string
  patterns: string[]
  min_uses: number
  enforce: 'block' | 'warn'
  hint_parts: string[]
}

/** 可选语法点，按源文档聚合。 */
export interface GrammarPoint {
  key: string
  label: string
  level: string
  source_path: string
  patterns: string[]
}

export interface GrammarPointsResponse {
  points: GrammarPoint[]
}

/** 口语开考时附带的最近五天新词。 */
export interface RecentWord {
  lemma: string
  chinese_mean: string
  level: string
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
  grammar_requirements: GrammarRequirement[]
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
  grammar_requirements: GrammarRequirement[]
}

export interface SpeakingPlansResponse {
  plans: SpeakingPlan[]
}

export interface SpeakingPlanDetailResponse {
  plan: SpeakingPlan
  items: SpeakingItem[]
  recent_words?: RecentWord[]
}

export interface SpeakingPlanGenerateInput {
  lang?: string
  level: string
  name: string
  description: string
  item_count?: number
}

export interface SpeakingPlanGeneratedEntry {
  position: number
  source: 'existing' | 'new'
  item: SpeakingItem
}

export interface SpeakingPlanGenerateResponse {
  plan: SpeakingPlan
  entries: SpeakingPlanGeneratedEntry[]
  warnings: string[]
}

/** PGG 试卷 PDF 导入任务。 */
export interface PdfImportJob {
  job_id: string
  original_name: string
  stored_path: string
  size_bytes: number
  file_md5: string
  lang: string
  status: 'pending' | 'queued' | 'running' | 'succeeded' | 'failed'
  message: string
  page_count: number
  result: Record<string, unknown> | null
  created_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
  deleted_at?: string | null
}

export interface PdfImportLog {
  log_id: number
  job_id: string
  level: string
  message: string
  created_at: string
}

export interface PdfImportJobsResponse {
  jobs: PdfImportJob[]
}

export interface PdfImportJobDetailResponse {
  job: PdfImportJob
  logs: PdfImportLog[]
}

/** 解析结果中的一个文本块，可人工修正题型与原文。 */
export interface PdfBlock {
  page_no: number
  paper_id: string
  exam_system: string
  lang: string
  section: string
  raw_text: string
}

export interface PdfPaper {
  paper_id: string
  pages: number[]
  sections: string[]
}

export interface PdfExamQuestion {
  paper_id: string
  exam_system?: string
  section: string
  q_no: string
  stem: string
  options: string[]
  correct_answer?: string | null
  level?: string
}

export interface PdfExamPaper {
  paper_id: string
  exam_system?: string
  level?: string
  year?: number
  title?: string
  source_note?: string
  question_count?: number
  sections?: string[]
  source_job_id?: string
}

export interface PdfExamData {
  papers: PdfExamPaper[]
  questions: PdfExamQuestion[]
}

/** 管理台 PGG 题库：在试卷基础上附带答案绑定与听写/写作统计。 */
export interface ExamAdminPaper extends PdfExamPaper {
  answered_count?: number
  diktat_count?: number
  writing_count?: number
}

export interface ExamDiktat {
  paper_id: string
  full_text: string
  word_count: number
  audio_ref?: string
}

export interface ExamWriting {
  paper_id: string
  prompt: string
  word_limit?: number | null
}

export interface PdfParseResult {
  lang: string
  source: string
  page_count: number
  ocr_pages?: number[]
  papers: PdfPaper[]
  section_page_counts: Record<string, number>
  blocks: PdfBlock[]
  exam?: PdfExamData
  exam_db_path?: string
}

export interface PdfJobBlocksResponse {
  job_id: string
  result: PdfParseResult
}

/** 分片上传会话；uploaded_chunks 用于断点续传。 */
export interface PdfUploadInitResponse {
  completed: boolean
  duplicate?: boolean
  original_name?: string
  upload_id: string
  job_id?: string
  status?: string
  chunk_size?: number
  total_chunks?: number
  uploaded_chunks?: number[]
}

export interface PdfUploadCompleteResponse {
  job_id: string
  status: string
  duplicate?: boolean
  original_name?: string
  warning?: string
}

// ---------------------------------------------------------------------------
// 新词库
// ---------------------------------------------------------------------------

export interface VocabWord {
  word_id: number
  lang: string
  lemma: string
  level: string
  word_type?: string
  gender?: string
  plural?: string
  chinese_mean: string
  english_mean?: string
  example_de?: string
  source_md_path?: string
  updated_at: string
}

export interface VocabWordsResponse {
  words: VocabWord[]
  total: number
  limit: number
  offset: number
}

export interface VocabImportResult {
  dry_run: boolean
  inserted: number
  updated: number
  total: number
  /** 标记为某天已学时的结果，仅当请求 tag_learned=true 且成功时返回。 */
  learned_marked?: number
  learned_ignored?: number
}
