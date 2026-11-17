import {
  AudioOutlined,
  DownloadOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  type TableProps,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { api, apiUrl, errorMessage, formatTime } from '../api'
import {
  LANGS,
  langLabel,
  type Lang,
  type ListeningFile,
  type ListeningJob,
  type ListeningJobDetailResponse,
  type ListeningJobLog,
} from '../types'

function jobStatusColor(status: string): string {
  if (status === 'built') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'running') return 'processing'
  if (status === 'pending') return 'warning'
  return 'default'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function logLevelColor(level: string): string {
  if (level === 'error') return 'red'
  if (level === 'warn' || level === 'warning') return 'orange'
  return 'blue'
}

/** 把 ISO 时间转为 "X秒前 / X分钟前"；空值返回 "—" */
function secondsAgo(iso?: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, Date.now() - t)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s} 秒前`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  return `${h} 小时前`
}

/**
 * 判断任务是否真在"活着"：
 *  - running + last_log_at 距现在 ≤ 120s → 活跃
 *  - running + 无日志 / 超 120s → 疑似卡死（whisper 加载模型时可能静默 ~60s，阈值设 120s）
 */
const STUCK_THRESHOLD_MS = 120_000
function isJobAlive(job: ListeningJob, now: number): boolean | null {
  if (job.status === 'pending') return null // 还没开始跑，不适用
  if (job.status !== 'running') return null
  if (!job.last_log_at) return false
  const t = new Date(job.last_log_at).getTime()
  if (Number.isNaN(t)) return false
  return now - t <= STUCK_THRESHOLD_MS
}

/**
 * 从 builder 日志解析当前"阶段 + 进度"，用于详情抽屉顶部展示。
 * 返回 { stage, progress }。
 */
function parseProgress(logs: ListeningJobLog[]): { stage: string; progress?: string } {
  const msg = logs.find((l) => l.stage === 'builder')?.message ?? ''
  if (msg.includes('加载 Whisper')) return { stage: '加载 Whisper 模型' }
  if (msg.includes('Whisper 模型加载完成')) return { stage: 'Whisper 模型加载完成', progress: '即将开始转写…' }
  if (msg.includes('转写中已处理')) {
    const m = msg.match(/转写中已处理 (\d+) 个 segment/)
    return { stage: 'Whisper 转写中', progress: m ? `${m[1]} segments` : undefined }
  }
  if (msg.includes('转写完成')) return { stage: 'Whisper 转写完成' }
  if (msg.includes('识别到')) {
    const m = msg.match(/识别到 (\d+) 道题/)
    return { stage: '准备切片', progress: m ? `${m[1]} 题` : undefined }
  }
  if (msg.includes('第') && msg.includes('题 完成')) {
    const m = msg.match(/第 (\d+)\/(\d+) 题/)
    return { stage: '切片 + 抽帧 + OCR', progress: m ? `${m[1]}/${m[2]}` : undefined }
  }
  if (msg.includes('导入完成')) return { stage: '导入完成' }
  if (msg.includes('starting listening import')) return { stage: '启动中' }
  if (msg.includes('下载')) return { stage: '下载媒体中' }
  return { stage: '初始化' }
}

const logColumns: TableProps<ListeningJobLog>['columns'] = [
  {
    title: '时间',
    dataIndex: 'created_at',
    width: 170,
    render: (value: string) => formatTime(value),
  },
  {
    title: '阶段',
    dataIndex: 'stage',
    width: 110,
    render: (value: string) => <Tag>{value}</Tag>,
  },
  {
    title: '级别',
    dataIndex: 'level',
    width: 90,
    render: (value: string) => <Tag color={logLevelColor(value)}>{value}</Tag>,
  },
  {
    title: '日志',
    dataIndex: 'message',
    render: (value: string) => <span style={{ wordBreak: 'break-all' }}>{value}</span>,
  },
]

interface ImportFormValues {
  url: string
  examId: string
  lang: Lang
  model: string
}

export default function ListeningImportPage() {
  const { message } = AntApp.useApp()
  const [form] = Form.useForm<ImportFormValues>()

  const [submitting, setSubmitting] = useState(false)
  const [jobs, setJobs] = useState<ListeningJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<ListeningJobDetailResponse | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailJobId, setDetailJobId] = useState<string>('')

  // 任务产物文件（视频 / 转写 / 音频 / 图片）
  const [files, setFiles] = useState<ListeningFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)

  // 每秒更新一次，用于"距上次活动 X 秒"的实时计算
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  // 上传文件引用（浏览器原生 File 类型）
  const [answersFile, setAnswersFile] = useState<File | null>(null)
  const [cookiesFile, setCookiesFile] = useState<File | null>(null)

  const loadJobs = async () => {
    setLoadingJobs(true)
    try {
      const res = await api.listeningJobs(50)
      setJobs(res.jobs)
    } catch (error) {
      message.error('加载任务列表失败：' + errorMessage(error))
    } finally {
      setLoadingJobs(false)
    }
  }

  useEffect(() => {
    void loadJobs()
  }, [refreshTick])

  // 详情 drawer 打开时轮询（running/pending）
  useEffect(() => {
    if (!detailOpen || !detailJobId) return
    let cancelled = false
    let timer: number | undefined

    const tick = async () => {
      setLoadingDetail(true)
      try {
        const data = await api.listeningJobDetail(detailJobId)
        if (cancelled) return
        setDetail(data)
        if (data.job.status === 'running' || data.job.status === 'pending') {
          timer = window.setTimeout(tick, 3000)
        }
      } catch {
        // 忽略轮询错误
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    }
    void tick()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [detailOpen, detailJobId])

  // 详情打开后加载可下载产物（视频 / 转写 / 音频 / 图片）
  useEffect(() => {
    if (!detailOpen || !detailJobId) {
      setFiles([])
      return
    }
    let cancelled = false
    setLoadingFiles(true)
    api
      .listeningJobFiles(detailJobId)
      .then((res) => {
        if (!cancelled) setFiles(res.files)
      })
      .catch(() => {
        if (!cancelled) setFiles([])
      })
      .finally(() => {
        if (!cancelled) setLoadingFiles(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailOpen, detailJobId, detail?.job.status])

  const sortedFiles = useMemo(() => {
    const weight = (path: string) => {
      if (path.startsWith('source/')) return 0
      if (path.startsWith('transcript')) return 1
      if (path === 'manifest.json') return 2
      if (path.startsWith('audio/')) return 3
      if (path.startsWith('images/')) return 4
      return 5
    }
    return [...files].sort(
      (a, b) => weight(a.path) - weight(b.path) || a.path.localeCompare(b.path),
    )
  }, [files])

  const onSubmit = async (values: ImportFormValues) => {
    if (!values.url.trim()) {
      message.warning('请输入音视频 URL')
      return
    }
    if (!values.examId.trim()) {
      message.warning('请输入 examId')
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('url', values.url.trim())
      formData.append('examId', values.examId.trim())
      formData.append('lang', values.lang)
      formData.append('model', values.model)
      if (answersFile) {
        formData.append('answers', answersFile)
      }
      if (cookiesFile) {
        formData.append('cookies', cookiesFile)
      }
      const result = await api.importListening(formData)
      message.success(`任务已启动：${result.job_id}`)
      form.resetFields()
      setAnswersFile(null)
      setCookiesFile(null)
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const openDetail = (jobId: string) => {
    setDetailJobId(jobId)
    setDetail(null)
    setDetailOpen(true)
  }

  const jobColumns: TableProps<ListeningJob>['columns'] = [
    {
      title: 'Exam ID',
      dataIndex: 'exam_id',
      width: 200,
      render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>,
    },
    {
      title: '语种',
      dataIndex: 'lang',
      width: 80,
      render: (value: string) => langLabel(value),
    },
    {
      title: '来源 URL',
      dataIndex: 'source_url',
      ellipsis: true,
      render: (value: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {value}
        </Typography.Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 140,
      render: (_: unknown, record: ListeningJob) => {
        const alive = isJobAlive(record, nowTick)
        return (
          <Space size={4} wrap>
            <Tag color={jobStatusColor(record.status)}>{record.status}</Tag>
            {alive === false ? (
              <Tag color="volcano" icon={<WarningOutlined />}>
                疑似卡死
              </Tag>
            ) : alive === true ? (
              <Tag color="cyan">活跃中</Tag>
            ) : null}
          </Space>
        )
      },
    },
    {
      title: '最后活动',
      dataIndex: 'last_log_at',
      width: 130,
      render: (_: string, record: ListeningJob) => secondsAgo(record.last_log_at),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 170,
      render: (value: string) => formatTime(value),
    },
    {
      title: '操作',
      width: 100,
      render: (_: unknown, record: ListeningJob) => (
        <Button size="small" type="link" onClick={() => openDetail(record.job_id)}>
          详情
        </Button>
      ),
    },
  ]

  // 详情里用的进度解析（最新一条 builder 日志）
  const detailProgress = useMemo(() => (detail ? parseProgress(detail.logs) : null), [detail])

  return (
    <div>
      <div className="page-head">
        <Typography.Title level={4} style={{ margin: 0 }}>
          听力导入
        </Typography.Title>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={9}>
          <Card
            title={
              <Space>
                <AudioOutlined />
                <span>从音视频 URL 导入</span>
              </Space>
            }
          >
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                lang: 'de',
                model: 'small',
              }}
              onFinish={onSubmit}
            >
              <Form.Item
                name="url"
                label="音视频 URL"
                rules={[{ required: true, message: '请输入 URL' }]}
                extra="支持 B 站 / YouTube 等 yt-dlp 兼容的视频页面地址"
              >
                <Input
                  placeholder="https://www.bilibili.com/video/BV1FLMGzgEk2/?p=6"
                  allowClear
                />
              </Form.Item>

              <Form.Item
                name="examId"
                label="Exam ID"
                rules={[
                  { required: true, message: '请输入 examId' },
                  {
                    pattern: /^[a-z0-9-]+$/,
                    message: '仅允许小写字母、数字、短横线',
                  },
                ]}
                extra="作为输出目录名，如 goethe-a1-hoeren-01"
              >
                <Input placeholder="goethe-a1-hoeren-01" allowClear />
              </Form.Item>

              <Form.Item name="lang" label="语种" rules={[{ required: true }]}>
                <Select options={LANGS} />
              </Form.Item>

              <Form.Item name="model" label="Whisper 模型">
                <Select
                  options={[
                    { value: 'tiny', label: 'tiny（最快，精度最低）' },
                    { value: 'base', label: 'base' },
                    { value: 'small', label: 'small（推荐，默认）' },
                    { value: 'medium', label: 'medium（精度更高，更慢）' },
                  ]}
                />
              </Form.Item>

              <Form.Item label="答案 CSV（可选）" extra="格式：题号,答案（如 1,B）">
                <Upload
                  beforeUpload={(file) => {
                    setAnswersFile(file)
                    return false // 不自动上传
                  }}
                  onRemove={() => setAnswersFile(null)}
                  maxCount={1}
                  accept=".csv"
                  fileList={answersFile ? [{ uid: '-1', name: answersFile.name, status: 'done' }] : []}
                >
                  <Button icon={<UploadOutlined />}>选择答案 CSV</Button>
                </Upload>
              </Form.Item>

              <Form.Item label="B 站 Cookies（可选）" extra="浏览器导出的 cookies.txt（Netscape 格式）">
                <Upload
                  beforeUpload={(file) => {
                    setCookiesFile(file)
                    return false
                  }}
                  onRemove={() => setCookiesFile(null)}
                  maxCount={1}
                  accept=".txt"
                  fileList={cookiesFile ? [{ uid: '-2', name: cookiesFile.name, status: 'done' }] : []}
                >
                  <Button icon={<UploadOutlined />}>选择 cookies.txt</Button>
                </Upload>
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={submitting} icon={<PlayCircleOutlined />}>
                启动导入
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={15}>
          <Card
            title="导入任务"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => setRefreshTick((t) => t + 1)}>
                刷新
              </Button>
            }
          >
            <Table<ListeningJob>
              size="small"
              rowKey="job_id"
              columns={jobColumns}
              dataSource={jobs}
              loading={loadingJobs}
              pagination={{ pageSize: 10 }}
              scroll={{ y: 480 }}
              locale={{ emptyText: '暂无任务' }}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        title={detail?.job.exam_id ? `任务详情 · ${detail.job.exam_id}` : '任务详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={720}
      >
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {detail.job.status === 'running' && detail.job.last_log_at && nowTick - new Date(detail.job.last_log_at).getTime() > STUCK_THRESHOLD_MS ? (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message="疑似卡死"
                description={`最后一条日志是 ${secondsAgo(detail.job.last_log_at)}，若 whisper 模型较大或下载慢，可能只是还没产生新输出；若长时间无变化，可终止任务重建。`}
              />
            ) : null}

            {detailProgress ? (
              <Card size="small" title="当前进度">
                <Space direction="vertical" size={4}>
                  <Typography.Text strong style={{ fontSize: 14 }}>
                    {detailProgress.stage}
                  </Typography.Text>
                  {detailProgress.progress ? (
                    <Typography.Text type="secondary">{detailProgress.progress}</Typography.Text>
                  ) : null}
                  {detail.job.last_log_at ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      距上次活动 {secondsAgo(detail.job.last_log_at)}
                    </Typography.Text>
                  ) : null}
                </Space>
              </Card>
            ) : null}

            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'job_id',
                  label: 'Job ID',
                  children: <Typography.Text copyable>{detail.job.job_id}</Typography.Text>,
                },
                {
                  key: 'exam_id',
                  label: 'Exam ID',
                  children: <Typography.Text copyable>{detail.job.exam_id}</Typography.Text>,
                },
                {
                  key: 'lang',
                  label: '语种',
                  children: langLabel(detail.job.lang),
                },
                {
                  key: 'source_url',
                  label: '来源 URL',
                  children: (
                    <Typography.Text copyable style={{ wordBreak: 'break-all' }}>
                      {detail.job.source_url}
                    </Typography.Text>
                  ),
                },
                {
                  key: 'status',
                  label: '状态',
                  children: <Tag color={jobStatusColor(detail.job.status)}>{detail.job.status}</Tag>,
                },
                ...(detail.job.error_msg
                  ? [
                      {
                        key: 'error',
                        label: '错误信息',
                        children: (
                          <Typography.Text type="danger" style={{ wordBreak: 'break-all' }}>
                            {detail.job.error_msg}
                          </Typography.Text>
                        ),
                      },
                    ]
                  : []),
                {
                  key: 'created_at',
                  label: '创建时间',
                  children: formatTime(detail.job.created_at),
                },
                {
                  key: 'updated_at',
                  label: '更新时间',
                  children: formatTime(detail.job.updated_at),
                },
                ...(detail.job.last_log_at
                  ? [
                      {
                        key: 'last_log',
                        label: '最后日志时间',
                        children: formatTime(detail.job.last_log_at),
                      },
                    ]
                  : []),
              ]}
            />

            <Card
              size="small"
              title={
                <Space>
                  <DownloadOutlined />
                  产物下载
                </Space>
              }
              extra={
                <Button
                  type="primary"
                  size="small"
                  icon={<DownloadOutlined />}
                  href={apiUrl(
                    `/api/listening/job/${encodeURIComponent(detailJobId)}/archive`,
                  )}
                >
                  打包下载 zip
                </Button>
              }
            >
              {loadingFiles ? (
                <Typography.Text type="secondary">加载文件列表…</Typography.Text>
              ) : sortedFiles.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无产物文件（任务未完成或目录为空）"
                />
              ) : (
                <List
                  size="small"
                  dataSource={sortedFiles}
                  style={{ maxHeight: 260, overflowY: 'auto' }}
                  renderItem={(file) => (
                    <List.Item
                      actions={[
                        <Button
                          key="download"
                          type="link"
                          size="small"
                          href={apiUrl(
                            `/api/listening/job/${encodeURIComponent(detailJobId)}/download?path=${encodeURIComponent(file.path)}`,
                          )}
                        >
                          下载
                        </Button>,
                      ]}
                    >
                      <Space size={8}>
                        <FileTextOutlined />
                        <Typography.Text style={{ wordBreak: 'break-all' }}>
                          {file.path}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {formatSize(file.size)}
                        </Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Card>

            <Typography.Text strong>运行日志（共 {detail.logs.length} 条）</Typography.Text>
            <Table<ListeningJobLog>
              size="small"
              rowKey={(record) => `${record.created_at}-${record.stage}-${record.message}`}
              columns={logColumns}
              dataSource={detail.logs}
              pagination={false}
              scroll={{ y: 360 }}
              loading={loadingDetail && !detail.logs.length}
              locale={{ emptyText: '暂无日志' }}
            />
          </Space>
        ) : (
          <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>
        )}
      </Drawer>
    </div>
  )
}
