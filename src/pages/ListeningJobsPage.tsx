import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  ReloadOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
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
  langLabel,
  type ListeningFile,
  type ListeningJob,
  type ListeningJobDetailResponse,
  type ListeningJobLog,
} from '../types'

const LEVEL_OPTIONS = [
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2' },
]

function levelColor(level: string): string {
  if (level === 'A1') return 'green'
  if (level === 'A2') return 'blue'
  if (level === 'B1') return 'orange'
  if (level === 'B2') return 'magenta'
  return 'purple'
}

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

const STUCK_THRESHOLD_MS = 120_000
function isJobAlive(job: ListeningJob, now: number): boolean | null {
  if (job.status === 'pending') return null
  if (job.status !== 'running') return null
  if (!job.last_log_at) return false
  const t = new Date(job.last_log_at).getTime()
  if (Number.isNaN(t)) return false
  return now - t <= STUCK_THRESHOLD_MS
}

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
  { title: '阶段', dataIndex: 'stage', width: 110, render: (v: string) => <Tag>{v}</Tag> },
  {
    title: '级别',
    dataIndex: 'level',
    width: 90,
    render: (v: string) => <Tag color={logLevelColor(v)}>{v}</Tag>,
  },
  {
    title: '日志',
    dataIndex: 'message',
    render: (v: string) => <span style={{ wordBreak: 'break-all' }}>{v}</span>,
  },
]

export default function ListeningJobsPage() {
  const { message } = AntApp.useApp()

  const [jobs, setJobs] = useState<ListeningJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<ListeningJobDetailResponse | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailJobId, setDetailJobId] = useState<string>('')

  const [files, setFiles] = useState<ListeningFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [uploadingAnswers, setUploadingAnswers] = useState(false)
  const [submittedAnswers, setSubmittedAnswers] = useState<{ number: number; answer: string }[]>([])

  const [editJob, setEditJob] = useState<ListeningJob | null>(null)
  const [editName, setEditName] = useState('')
  const [editLevel, setEditLevel] = useState('A1')
  const [savingMeta, setSavingMeta] = useState(false)
  const [refreshingLogs, setRefreshingLogs] = useState(false)

  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

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

  // 打开详情时加载一次；后续日志由「刷新日志」按钮手动增量拉取，不做定时轮询。
  useEffect(() => {
    if (!detailOpen || !detailJobId) return
    let cancelled = false
    setLoadingDetail(true)
    api
      .listeningJobDetail(detailJobId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    api
      .listeningJobAnswers(detailJobId)
      .then((data) => {
        if (!cancelled) setSubmittedAnswers(data.answers)
      })
      .catch(() => {
        // 无 manifest 或未绑定答案时保持为空
      })
    return () => {
      cancelled = true
    }
  }, [detailOpen, detailJobId])

  // 手动增量刷新：只拉取比当前最新 log_id 更新的日志，合并到列表顶部。
  const refreshLogs = async () => {
    if (!detailJobId || refreshingLogs) return
    const lastLogId =
      detail?.logs.reduce((max, log) => Math.max(max, log.log_id ?? 0), 0) ?? 0
    setRefreshingLogs(true)
    try {
      const data = await api.listeningJobDetail(detailJobId, lastLogId)
      setDetail((prev) => {
        const base = prev && prev.job.job_id === data.job.job_id ? prev.logs : []
        const merged =
          lastLogId > 0 ? [...[...data.logs].reverse(), ...base] : data.logs
        return { job: data.job, logs: merged }
      })
      if (data.logs.length === 0) {
        message.info('暂无新日志')
      }
    } catch (error) {
      message.error('刷新日志失败：' + errorMessage(error))
    } finally {
      setRefreshingLogs(false)
    }
  }

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
    return [...files].sort((a, b) => weight(a.path) - weight(b.path) || a.path.localeCompare(b.path))
  }, [files])

  const handleDownloadZip = async () => {
    if (downloadingZip || loadingFiles || !detail?.job) return
    setDownloadingZip(true)
    try {
      await api.listeningJobFiles(detailJobId)
      const url = apiUrl(
        `/api/listening/job/${encodeURIComponent(detailJobId)}/download?path=${encodeURIComponent(`${detail.job.exam_id}.zip`)}`,
      )
      const link = document.createElement('a')
      link.href = url
      link.download = `${detail.job.exam_id}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => setDownloadingZip(false), 1500)
    } catch (e) {
      message.error(e instanceof Error ? e.message : '下载失败')
      setDownloadingZip(false)
    }
  }

  const openDetail = (jobId: string) => {
    setDetailJobId(jobId)
    setDetail(null)
    setSubmittedAnswers([])
    setDetailOpen(true)
  }

  const openEditMeta = (job: ListeningJob) => {
    setEditJob(job)
    setEditName(job.name ?? '')
    setEditLevel(job.level || 'A1')
  }

  const handleSaveMeta = async () => {
    if (!editJob || savingMeta) return
    const jobId = editJob.job_id
    const name = editName.trim()
    const level = editLevel
    setSavingMeta(true)
    try {
      await api.updateListeningJobMeta(jobId, { name, level })
      const savedName = name || null
      setJobs((prev) =>
        prev.map((job) => (job.job_id === jobId ? { ...job, name: savedName, level } : job)),
      )
      setDetail((prev) =>
        prev?.job.job_id === jobId
          ? { ...prev, job: { ...prev.job, name: savedName, level } }
          : prev,
      )
      setEditJob(null)
      message.success('任务信息已更新')
    } catch (error) {
      message.error('保存失败：' + errorMessage(error))
    } finally {
      setSavingMeta(false)
    }
  }

  const jobColumns: TableProps<ListeningJob>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 180,
      ellipsis: true,
      render: (_: unknown, record: ListeningJob) => (
        <Typography.Text strong={!!record.name} type={record.name ? undefined : 'secondary'}>
          {record.name || record.exam_id}
        </Typography.Text>
      ),
    },
    {
      title: 'Exam ID',
      dataIndex: 'exam_id',
      width: 200,
      render: (v: string) => <Typography.Text copyable>{v}</Typography.Text>,
    },
    { title: '语种', dataIndex: 'lang', width: 80, render: (v: string) => langLabel(v) },
    {
      title: '等级',
      dataIndex: 'level',
      width: 80,
      render: (v: string) => <Tag color={levelColor(v || 'A1')}>{v || 'A1'}</Tag>,
    },
    {
      title: '来源 URL',
      dataIndex: 'source_url',
      ellipsis: true,
      render: (v: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {v}
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
      render: (v: string) => formatTime(v),
    },
    {
      title: '操作',
      width: 220,
      render: (_: unknown, record: ListeningJob) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => openDetail(record.job_id)}>
            详情
          </Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditMeta(record)}></Button>
          <Popconfirm
            title="确定删除该听力任务？"
            description="仅软删除，产物文件保留，可在数据库恢复。"
            onConfirm={async () => {
              try {
                await api.deleteListeningJob(record.job_id)
                message.success('已删除')
                setRefreshTick((t) => t + 1)
              } catch (e) {
                message.error('删除失败：' + errorMessage(e))
              }
            }}
            okText="删除"
            cancelText="取消"
          >
            <Button size="small" type="link" danger icon={<DeleteOutlined />}></Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const detailProgress = useMemo(() => (detail ? parseProgress(detail.logs) : null), [detail])

  return (
    <div>
      <div className="page-head">
        <Typography.Title level={4} style={{ margin: 0 }}>
          听力导入任务
        </Typography.Title>
      </div>

      <Card
        title="任务列表"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshTick((t) => t + 1)}>
            刷新
          </Button>
        }
      >
        <Table<ListeningJob>
          rowKey="job_id"
          columns={jobColumns}
          dataSource={jobs}
          loading={loadingJobs}
          pagination={{ pageSize: 10 }}
          scroll={{ y: 480 }}
          locale={{ emptyText: '暂无任务' }}
        />
      </Card>

      <Drawer
        title={detail?.job ? `任务详情 · ${detail.job.name || detail.job.exam_id}` : '任务详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={720}
      >
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {detail.job.status === 'running' &&
            detail.job.last_log_at &&
            nowTick - new Date(detail.job.last_log_at).getTime() > STUCK_THRESHOLD_MS ? (
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
                { key: 'name', label: '名称', children: detail.job.name || '未命名（使用 Exam ID）' },
                { key: 'lang', label: '语种', children: langLabel(detail.job.lang) },
                {
                  key: 'level',
                  label: '等级',
                  children: <Tag color={levelColor(detail.job.level || 'A1')}>{detail.job.level || 'A1'}</Tag>,
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
                { key: 'created_at', label: '创建时间', children: formatTime(detail.job.created_at) },
                { key: 'updated_at', label: '更新时间', children: formatTime(detail.job.updated_at) },
                ...(detail.job.last_log_at
                  ? [{ key: 'last_log', label: '最后日志时间', children: formatTime(detail.job.last_log_at) }]
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
                  loading={downloadingZip || loadingFiles}
                  disabled={downloadingZip || loadingFiles || !detail?.job}
                  onClick={handleDownloadZip}
                >
                  {downloadingZip ? '正在打包…' : loadingFiles ? '准备中…' : '打包下载 zip'}
                </Button>
              }
            >
              {loadingFiles ? (
                <Typography.Text type="secondary">加载文件列表…</Typography.Text>
              ) : sortedFiles.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无产物文件（任务未完成或目录为空）" />
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
                        <Typography.Text style={{ wordBreak: 'break-all' }}>{file.path}</Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {formatSize(file.size)}
                        </Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Card>

            <Card
              size="small"
              title={
                <Space>
                  <CheckCircleOutlined />
                  补充答案
                </Space>
              }
              style={{ marginTop: 12 }}
            >
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
                管理员下载整套文件后人工听题，将答案整理为 CSV（格式：
                <Typography.Text code>题号,答案</Typography.Text>
                ，选择题填 A/B/C/D，判断题填 richtig/falsch），上传后自动写入 manifest。
                重新上传会覆盖已有答案。
              </Typography.Paragraph>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Upload
                  accept=".csv"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const formData = new FormData()
                    formData.append('answers', file)
                    const overwrite = submittedAnswers.length > 0
                    setUploadingAnswers(true)
                    api
                      .updateListeningAnswers(detailJobId, formData)
                      .then((res) => {
                        setSubmittedAnswers(res.answers.sort((a, b) => a.number - b.number))
                        message.success(
                          overwrite ? `已覆盖为 ${res.updated_count} 题答案` : `已绑定 ${res.updated_count} 题答案`,
                        )
                      })
                      .catch((err) => message.error(errorMessage(err)))
                      .finally(() => setUploadingAnswers(false))
                    return false
                  }}
                >
                  <Button type="primary" icon={<UploadOutlined />} loading={uploadingAnswers}>
                    {submittedAnswers.length > 0 ? '重新上传答案 CSV' : '上传答案 CSV'}
                  </Button>
                </Upload>
                {submittedAnswers.length > 0 && (
                  <div style={{ fontSize: 13 }}>
                    <Typography.Text strong>已绑定答案（{submittedAnswers.length} 题）：</Typography.Text>
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {submittedAnswers.map((a) => (
                        <Tag key={a.number} color="blue">
                          第{a.number}题 → {a.answer}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </Space>
            </Card>

            <Card
              size="small"
              title={`运行日志（共 ${detail.logs.length} 条）`}
              extra={
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={refreshingLogs}
                  onClick={() => void refreshLogs()}
                >
                  刷新日志
                </Button>
              }
            >
              <Table<ListeningJobLog>
                size="small"
                rowKey={(record) =>
                  record.log_id ? String(record.log_id) : `${record.created_at}-${record.stage}-${record.message}`
                }
                columns={logColumns}
                dataSource={detail.logs}
                pagination={false}
                scroll={{ y: 360 }}
                loading={loadingDetail && !detail.logs.length}
                locale={{ emptyText: '暂无日志' }}
              />
            </Card>
          </Space>
        ) : (
          <div style={{ textAlign: 'center', padding: 48 }}>加载中...</div>
        )}
      </Drawer>

      <Modal
        title="编辑任务"
        open={!!editJob}
        onOk={() => void handleSaveMeta()}
        onCancel={() => setEditJob(null)}
        confirmLoading={savingMeta}
        cancelButtonProps={{ disabled: savingMeta }}
        okText="保存"
        cancelText="取消"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text type="secondary">Exam ID：{editJob?.exam_id}</Typography.Text>
          <div>
            <Typography.Text>等级</Typography.Text>
            <Select
              value={editLevel}
              onChange={setEditLevel}
              options={LEVEL_OPTIONS}
              style={{ width: '100%', marginTop: 6 }}
              disabled={savingMeta}
            />
          </div>
          <div>
            <Typography.Text>名称</Typography.Text>
            <Input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              onPressEnter={() => void handleSaveMeta()}
              maxLength={100}
              showCount
              placeholder="输入任务名称"
              style={{ marginTop: 6 }}
              disabled={savingMeta}
            />
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            名称留空则清除自定义名称，列表恢复显示 Exam ID。
          </Typography.Text>
        </Space>
      </Modal>
    </div>
  )
}
