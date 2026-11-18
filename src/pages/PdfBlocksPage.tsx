import {
  ArrowLeftOutlined,
  EditOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  type TableProps,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage } from '../api'
import type { PdfBlock, PdfImportJob, PdfParseResult } from '../types'

const SECTION_OPTIONS = [
  { value: 'diktat', label: '听写 Diktat' },
  { value: 'hoeren', label: '听力 Hörverstehen' },
  { value: 'lesen', label: '阅读 Leseverstehen' },
  { value: 'grammar', label: '语法词汇 Grammatik' },
  { value: 'writing', label: '写作 Schriftlicher Ausdruck' },
  { value: 'unknown', label: '未识别' },
]

const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  SECTION_OPTIONS.map((option) => [option.value, option.label]),
)

const SECTION_COLORS: Record<string, string> = {
  diktat: 'purple',
  hoeren: 'blue',
  lesen: 'green',
  grammar: 'orange',
  writing: 'magenta',
  unknown: 'default',
}

export default function PdfBlocksPage() {
  const { jobId = '' } = useParams()
  const navigate = useNavigate()
  const { message } = AntApp.useApp()

  const [job, setJob] = useState<PdfImportJob | null>(null)
  const [result, setResult] = useState<PdfParseResult | null>(null)
  const [blocks, setBlocks] = useState<PdfBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [paperFilter, setPaperFilter] = useState('ALL')
  const [sectionFilter, setSectionFilter] = useState('ALL')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editing, setEditing] = useState<PdfBlock | null>(null)

  const load = async () => {
    if (!jobId) return
    setLoading(true)
    try {
      const [detail, parsed] = await Promise.all([
        api.pdfJobDetail(jobId),
        api.pdfJobBlocks(jobId),
      ])
      setJob(detail.job)
      setResult(parsed.result)
      setBlocks(parsed.result.blocks ?? [])
      setDirty(false)
    } catch (error) {
      message.error('加载解析结果失败：' + errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [jobId])

  const papers = useMemo(() => {
    const set = new Set<string>()
    blocks.forEach((block) => {
      if (block.paper_id) set.add(block.paper_id)
    })
    return [...set].sort()
  }, [blocks])

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    blocks.forEach((block) => {
      counts[block.section] = (counts[block.section] ?? 0) + 1
    })
    return counts
  }, [blocks])

  const rows = useMemo(
    () =>
      blocks
        .map((block, index) => ({ ...block, index }))
        .filter((block) => paperFilter === 'ALL' || block.paper_id === paperFilter)
        .filter((block) => sectionFilter === 'ALL' || block.section === sectionFilter),
    [blocks, paperFilter, sectionFilter],
  )

  const updateBlock = (index: number, patch: Partial<PdfBlock>) => {
    setBlocks((prev) => prev.map((block, i) => (i === index ? { ...block, ...patch } : block)))
    setDirty(true)
  }

  const openEdit = (index: number) => {
    setEditingIndex(index)
    setEditing({ ...blocks[index] })
  }

  const confirmEdit = () => {
    if (editingIndex === null || !editing) return
    updateBlock(editingIndex, editing)
    setEditingIndex(null)
    setEditing(null)
  }

  const handleSave = async () => {
    if (!jobId || saving) return
    setSaving(true)
    try {
      await api.savePdfBlocks(jobId, blocks)
      message.success('校对结果已保存')
      setDirty(false)
      void load()
    } catch (error) {
      message.error('保存失败：' + errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const columns: TableProps<(PdfBlock & { index: number })>['columns'] = [
    {
      title: '页码',
      dataIndex: 'page_no',
      width: 90,
      render: (value: number, record) => (
        <InputNumber
          size="small"
          min={1}
          value={value}
          style={{ width: 70 }}
          onChange={(next) => updateBlock(record.index, { page_no: Number(next) || 1 })}
        />
      ),
    },
    {
      title: '套卷',
      dataIndex: 'paper_id',
      width: 170,
      render: (value: string, record) => (
        <Input
          size="small"
          value={value}
          placeholder="如 pgg_2013_a"
          onChange={(event) => updateBlock(record.index, { paper_id: event.target.value })}
        />
      ),
    },
    {
      title: '题型',
      dataIndex: 'section',
      width: 190,
      render: (value: string, record) => (
        <Select
          size="small"
          value={value}
          style={{ width: 180 }}
          options={SECTION_OPTIONS}
          onChange={(next) => updateBlock(record.index, { section: next })}
        />
      ),
    },
    {
      title: '文本',
      dataIndex: 'raw_text',
      render: (value: string) => (
        <Typography.Paragraph
          style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
          ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
        >
          {value || '（空）'}
        </Typography.Paragraph>
      ),
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, record) => (
        <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record.index)}>
          编辑
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pdf-import')}>
          返回任务列表
        </Button>
        <Typography.Title level={4} style={{ margin: 0 }}>
          解析校对{job ? ` · ${job.original_name}` : ''}
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
          重新加载
        </Button>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          disabled={!dirty || blocks.length === 0}
          loading={saving}
          onClick={() => void handleSave()}
        >
          保存校对
        </Button>
      </Space>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="校对会覆盖该任务的 result.json 与数据库中的解析摘要；题型和套卷可直接在表格里修改，正文请点「编辑」。"
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="PDF 页数" value={job?.page_count ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="文本块" value={blocks.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="识别套卷" value={papers.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.45)' }}>题型分布</div>
            <Space size={4} wrap>
              {Object.keys(sectionCounts).length === 0 && <Tag>—</Tag>}
              {Object.entries(sectionCounts).map(([section, count]) => (
                <Tag key={section} color={SECTION_COLORS[section] ?? 'default'}>
                  {SECTION_LABELS[section] ?? section} {count}
                </Tag>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title="文本块"
        extra={
          <Space>
            <Select
              value={paperFilter}
              onChange={setPaperFilter}
              style={{ width: 180 }}
              options={[
                { value: 'ALL', label: '全部套卷' },
                { value: '', label: '未归属套卷' },
                ...papers.map((paper) => ({ value: paper, label: paper })),
              ]}
            />
            <Select
              value={sectionFilter}
              onChange={setSectionFilter}
              style={{ width: 200 }}
              options={[{ value: 'ALL', label: '全部题型' }, ...SECTION_OPTIONS]}
            />
          </Space>
        }
      >
        <Table<(PdfBlock & { index: number })>
          rowKey="index"
          size="small"
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{
            emptyText: (
              <Empty description={result ? '没有匹配的文本块' : '解析结果尚未生成'} />
            ),
          }}
        />
      </Card>

      <Modal
        title={`编辑文本块 · 第 ${editing?.page_no ?? '-'} 页`}
        open={editingIndex !== null}
        onOk={confirmEdit}
        onCancel={() => {
          setEditingIndex(null)
          setEditing(null)
        }}
        okText="确定"
        cancelText="取消"
        width={900}
      >
        {editing && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap>
              <span>页码</span>
              <InputNumber
                min={1}
                value={editing.page_no}
                onChange={(next) => setEditing({ ...editing, page_no: Number(next) || 1 })}
              />
              <span>套卷</span>
              <Input
                value={editing.paper_id}
                style={{ width: 180 }}
                placeholder="如 pgg_2013_a"
                onChange={(event) => setEditing({ ...editing, paper_id: event.target.value })}
              />
              <span>题型</span>
              <Select
                value={editing.section}
                style={{ width: 200 }}
                options={SECTION_OPTIONS}
                onChange={(next) => setEditing({ ...editing, section: next })}
              />
            </Space>
            <Input.TextArea
              value={editing.raw_text}
              autoSize={{ minRows: 12, maxRows: 24 }}
              onChange={(event) => setEditing({ ...editing, raw_text: event.target.value })}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}
