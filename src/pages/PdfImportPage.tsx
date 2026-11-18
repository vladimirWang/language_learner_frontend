import {
  EditOutlined,
  FileTextOutlined,
  RedoOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Select,
  Space,
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
import type { PdfImportJob, PdfImportLog } from '../types'

const STATUS_COLORS: Record<string, string> = {
  pending: 'warning',
  queued: 'processing',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待投递',
  queued: '排队中',
  running: '解析中',
  succeeded: '已完成',
  failed: '失败',
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function PdfImportPage() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()

  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [lang, setLang] = useState('de')
  const [uploading, setUploading] = useState(false)

  const [jobs, setJobs] = useState<PdfImportJob[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailJob, setDetailJob] = useState<PdfImportJob | null>(null)
  const [logs, setLogs] = useState<PdfImportLog[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailJobId, setDetailJobId] = useState('')
  const [detailTick, setDetailTick] = useState(0)

  const loadJobs = async () => {
    setLoading(true)
    try {
      const res = await api.pdfJobs(50)
      setJobs(res.jobs ?? [])
    } catch (error) {
      message.error('加载导入任务失败：' + errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadJobs()
  }, [refreshTick])

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
    const formData = new FormData()
    formData.append('file', file)
    formData.append('lang', lang)
    setUploading(true)
    try {
      const res = await api.uploadPdf(formData)
      message.success(
        res.error ? res.error : `已提交解析任务：${res.job_id}`,
      )
      setFileList([])
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
      render: (v: string) => <Tag color={STATUS_COLORS[v] ?? 'default'}>{STATUS_LABELS[v] ?? v}</Tag>,
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
      width: 230,
      render: (_: unknown, record: PdfImportJob) => (
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
          <Typography.Text type="secondary">
            支持较大的 PDF；文件落盘与入库成功后才投递消息，消息失败可在任务列表重试。
          </Typography.Text>
        </Space>
      </Card>

      <Card
        title="导入任务"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshTick((t) => t + 1)}>
            刷新
          </Button>
        }
      >
        <Table<PdfImportJob>
          rowKey="job_id"
          columns={columns}
          dataSource={jobs}
          loading={loading}
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
