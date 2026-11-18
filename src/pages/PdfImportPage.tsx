import {
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  RedoOutlined,
  ReloadOutlined,
  UndoOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Popconfirm,
  Progress,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  type TableProps,
  type UploadFile,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage, formatTime } from '../api'
import { computeFileMD5, runWithConcurrency } from '../utils'
import type { PdfImportJob, PdfImportLog } from '../types'

const STATUS_COLORS: Record<string, string> = {
  pending: 'warning',
  queued: 'processing',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '等待解析',
  queued: '等待解析',
  running: '正在解析',
  succeeded: '已完成',
  failed: '失败',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const PDF_CHUNK_SIZE = 10 * 1024 * 1024 // 10MB
const PDF_CHUNK_CONCURRENCY = 6

/** 用文件名+大小+修改时间生成稳定指纹，供服务端定位未完成的分片会话。 */
async function fileFingerprint(file: File): Promise<string> {
  const base = `${file.name}|${file.size}|${file.lastModified}`
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(base),
    )
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }
  return base
}

export default function PdfImportPage() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()

  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [lang, setLang] = useState('de')
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadPhase, setUploadPhase] = useState<'hashing' | 'uploading'>('uploading')

  const [jobs, setJobs] = useState<PdfImportJob[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [showDeleted, setShowDeleted] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailJob, setDetailJob] = useState<PdfImportJob | null>(null)
  const [logs, setLogs] = useState<PdfImportLog[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailJobId, setDetailJobId] = useState('')
  const [detailTick, setDetailTick] = useState(0)

  const loadJobs = async () => {
    setLoading(true)
    try {
      const res = await api.pdfJobs(50, showDeleted)
      setJobs(res.jobs ?? [])
    } catch (error) {
      message.error('加载导入任务失败：' + errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadJobs()
  }, [refreshTick, showDeleted])

  useEffect(() => {
    if (!detailOpen || !detailJobId) return
    let cancelled = false
    setDetailLoading(true)
    api
      .pdfJobDetail(detailJobId)
      .then((data) => {
        if (cancelled) return
        setDetailJob(data.job)
        setLogs(data.logs ?? [])
      })
      .catch((error) => {
        if (!cancelled) message.error('加载任务详情失败：' + errorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailOpen, detailJobId, detailTick])

  const handleUpload = async () => {
    const file = fileList[0]?.originFileObj
    if (!file) {
      message.warning('请先选择 PDF 文件')
      return
    }
    setUploading(true)
    setUploadPercent(0)
    setUploadPhase('hashing')
    try {
      const [fingerprint, md5] = await Promise.all([
        fileFingerprint(file),
        computeFileMD5(file, setUploadPercent),
      ])
      setUploadPhase('uploading')
      setUploadPercent(0)
      const init = await api.initPdfUpload({
        filename: file.name,
        size: file.size,
        lang,
        fingerprint,
        md5,
      })
      if (init.completed && init.job_id) {
        message.info(
          init.duplicate
            ? `相同文件已存在（${init.original_name ?? file.name}），已定位到任务 ${init.job_id}`
            : '该文件已上传，导入任务已存在',
        )
        setFileList([])
        setRefreshTick((t) => t + 1)
        return
      }
      const chunkSize = init.chunk_size ?? PDF_CHUNK_SIZE
      const totalChunks = init.total_chunks ?? Math.ceil(file.size / chunkSize)
      const uploaded = new Set(init.uploaded_chunks ?? [])
      let done = uploaded.size
      setUploadPercent(Math.round((done / totalChunks) * 100))
      // 未上传的分片作为任务工厂交给并发控制器，最多 6 个分片同时在传。
      const pendingChunks: Array<() => Promise<void>> = []
      for (let index = 0; index < totalChunks; index += 1) {
        if (uploaded.has(index)) continue
        pendingChunks.push(async () => {
          const blob = file.slice(
            index * chunkSize,
            Math.min((index + 1) * chunkSize, file.size),
          )
          await api.uploadPdfChunk(init.upload_id, index, blob)
          done += 1
          setUploadPercent(Math.round((done / totalChunks) * 100))
        })
      }
      await runWithConcurrency(pendingChunks, PDF_CHUNK_CONCURRENCY)
      const res = await api.completePdfUpload(init.upload_id)
      // 上传与投递已完成，立即关闭 loading，任务列表随后异步刷新。
      setUploading(false)
      setFileList([])
      if (res.duplicate) {
        message.info(`相同文件已存在，已复用任务 ${res.job_id}`)
      } else if (res.warning) {
        message.warning(res.warning)
      } else {
        message.success('已提交解析任务')
      }
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('上传失败：' + errorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  const openDetail = (job: PdfImportJob) => {
    setDetailJobId(job.job_id)
    setDetailJob(null)
    setLogs([])
    setDetailOpen(true)
  }

  const handleDelete = async (job: PdfImportJob) => {
    try {
      await api.deletePdfJob(job.job_id)
      message.success('任务已删除，可在「显示已删除」中恢复')
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('删除失败：' + errorMessage(error))
    }
  }

  const handleRestore = async (job: PdfImportJob) => {
    try {
      await api.restorePdfJob(job.job_id)
      message.success('任务已恢复')
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('恢复失败：' + errorMessage(error))
    }
  }

  const handleRetry = async (job: PdfImportJob) => {
    try {
      await api.retryPdfJob(job.job_id)
      message.success('已重新投递')
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('重试失败：' + errorMessage(error))
    }
  }

  const columns: TableProps<PdfImportJob>['columns'] = [
    { title: '文件名', dataIndex: 'original_name', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string, record) =>
        record.deleted_at ? (
          <Tag color="default">已删除</Tag>
        ) : (
          <Tag color={STATUS_COLORS[v] ?? 'default'}>{STATUS_LABELS[v] ?? v}</Tag>
        ),
    },
    {
      title: '页数',
      dataIndex: 'page_count',
      width: 80,
      render: (v: number) => (v > 0 ? v : '—'),
    },
    {
      title: '大小',
      dataIndex: 'size_bytes',
      width: 90,
      render: (v: number) => formatSize(v),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v: string) => formatTime(v),
    },
    {
      title: '结果',
      dataIndex: 'message',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    {
      title: '操作',
      width: 280,
      render: (_: unknown, record: PdfImportJob) =>
        record.deleted_at ? (
          <Button
            size="small"
            type="link"
            icon={<UndoOutlined />}
            onClick={() => void handleRestore(record)}
          >
            恢复
          </Button>
        ) : (
          <Space size={4}>
            <Button size="small" type="link" icon={<FileTextOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
            <Button
              size="small"
              type="link"
              icon={<EditOutlined />}
              disabled={record.status !== 'succeeded'}
              onClick={() => navigate(`/pdf-import/${record.job_id}`)}
            >
              校对
            </Button>
            <Button
              size="small"
              type="link"
              icon={<RedoOutlined />}
              disabled={record.status === 'running'}
              onClick={() => handleRetry(record)}
            >
              重试
            </Button>
            <Popconfirm
              title="删除该导入任务？"
              description="文件与解析结果会保留，可在「显示已删除」中恢复。"
              okText="删除"
              cancelText="取消"
              onConfirm={() => void handleDelete(record)}
            >
              <Button size="small" type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
    },
  ]

  const logColumns: TableProps<PdfImportLog>['columns'] = [
    { title: '时间', dataIndex: 'created_at', width: 170, render: (v: string) => formatTime(v) },
    {
      title: '级别',
      dataIndex: 'level',
      width: 80,
      render: (v: string) => <Tag color={v === 'error' ? 'red' : v === 'warn' ? 'orange' : 'blue'}>{v}</Tag>,
    },
    { title: '日志', dataIndex: 'message', render: (v: string) => <span style={{ wordBreak: 'break-all' }}>{v}</span> },
  ]

  return (
    <div>
      <div className="page-head">
        <Typography.Title level={4} style={{ margin: 0 }}>
          PDF 试卷导入
        </Typography.Title>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="上传德专四级（PGG）真题 PDF：文件先保存到服务端并登记数据库，再由 RabbitMQ 投递给解析任务，按套卷与题型输出可校对的中间 JSON。"
      />

      <Card title="上传试卷" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Select
              value={lang}
              onChange={setLang}
              style={{ width: 120 }}
              options={[
                { value: 'de', label: '德语' },
                { value: 'en', label: '英语' },
                { value: 'ja', label: '日语' },
              ]}
            />
            <Upload
              accept=".pdf"
              maxCount={1}
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: next }) => setFileList(next)}
            >
              <Button icon={<UploadOutlined />}>选择 PDF</Button>
            </Upload>
            <Button type="primary" loading={uploading} onClick={handleUpload}>
              上传并解析
            </Button>
          </Space>
          {uploading && (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text type="secondary">
                {uploadPhase === 'hashing' ? '正在计算文件 MD5…' : '正在上传分片…'}
              </Typography.Text>
              <Progress percent={uploadPercent} size="small" status="active" />
            </Space>
          )}
          <Typography.Text type="secondary">
            大文件按 8MB 分片上传，中断后重新选择同一文件会从已上传分片继续；合并完成即投递消息队列。
          </Typography.Text>
        </Space>
      </Card>

      <Card
        title="导入任务"
        extra={
          <Space>
            <Space size={4}>
              <Switch size="small" checked={showDeleted} onChange={setShowDeleted} />
              <Typography.Text type="secondary">显示已删除</Typography.Text>
            </Space>
            <Button icon={<ReloadOutlined />} onClick={() => setRefreshTick((t) => t + 1)}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table<PdfImportJob>
          rowKey="job_id"
          columns={columns}
          dataSource={jobs}
          loading={loading}
          rowClassName={(record) => (record.deleted_at ? 'row-deleted' : '')}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '暂无导入任务' }}
        />
      </Card>

      <Drawer
        title={detailJob ? detailJob.original_name : '任务详情'}
        width={720}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => setDetailTick((t) => t + 1)}>
            刷新
          </Button>
        }
      >
        {detailJob && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="任务 ID" span={2}>
                {detailJob.job_id}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLORS[detailJob.status] ?? 'default'}>
                  {STATUS_LABELS[detailJob.status] ?? detailJob.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="页数">{detailJob.page_count || '—'}</Descriptions.Item>
              <Descriptions.Item label="文件大小">{formatSize(detailJob.size_bytes)}</Descriptions.Item>
              <Descriptions.Item label="MD5">{detailJob.file_md5}</Descriptions.Item>
              <Descriptions.Item label="存放路径" span={2}>
                {detailJob.stored_path}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">{formatTime(detailJob.created_at)}</Descriptions.Item>
              <Descriptions.Item label="完成时间">
                {detailJob.finished_at ? formatTime(detailJob.finished_at) : '—'}
              </Descriptions.Item>
            </Descriptions>

            {detailJob.result && (
              <Card size="small" title="解析摘要" style={{ marginBottom: 16 }}>
                <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {JSON.stringify(detailJob.result, null, 2)}
                </pre>
              </Card>
            )}

            <Card size="small" title="解析日志">
              <Table<PdfImportLog>
                rowKey="log_id"
                size="small"
                columns={logColumns}
                dataSource={logs}
                loading={detailLoading}
                pagination={false}
                scroll={{ y: 360 }}
                locale={{ emptyText: '暂无日志' }}
              />
            </Card>
          </>
        )}
      </Drawer>
    </div>
  )
}
