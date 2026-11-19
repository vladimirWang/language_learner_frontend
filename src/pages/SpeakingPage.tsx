import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  type TableProps,
} from 'antd'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import type { GrammarPoint, SpeakingItem } from '../types'

const LEVEL_OPTIONS = [
  { value: 'A1', label: 'A1 - 入门' },
  { value: 'A2', label: 'A2 - 初级' },
  { value: 'B1', label: 'B1 - 中级' },
  { value: 'B2', label: 'B2 - 中高级' },
]

const EXAM_PART_OPTIONS = [
  { value: 'part1_intro', label: '第一部分 · 自我介绍与问答' },
  { value: 'part2_presentation', label: '第二部分 · 主题陈述' },
  { value: 'part3_discussion', label: '第三部分 · 双人讨论' },
]

const EXAM_PART_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_PART_OPTIONS.map((o) => [o.value, o.label]),
)

interface SpeakingFormValues {
  level: string
  exam_part: string
  topic: string
  prompt_de: string
  prompt_zh?: string
  expected_points?: string[]
  target_grammar?: string[]
  ref_answer?: string
  error_note?: string
  sort_order: number
  active: boolean
}

/** 把后端 JSON 数组字符串解析为字符串数组；异常时返回空数组。 */
function parsePoints(raw: string): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export default function SpeakingPage() {
  const { message, modal } = AntApp.useApp()

  const [items, setItems] = useState<SpeakingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [levelFilter, setLevelFilter] = useState<string>('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SpeakingItem | null>(null)
  const [form] = Form.useForm<SpeakingFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [grammarPoints, setGrammarPoints] = useState<GrammarPoint[]>([])

  useEffect(() => {
    api
      .listGrammarPoints({ lang: 'de' })
      .then((res) => setGrammarPoints(res.points ?? []))
      .catch(() => setGrammarPoints([]))
  }, [])

  const loadItems = async () => {
    setLoading(true)
    try {
      const res = await api.listSpeakingItems({ activeOnly: false })
      setItems(res.items ?? [])
    } catch (error) {
      message.error('加载口语题库失败：' + errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
  }, [refreshTick])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      level: 'A1',
      exam_part: 'part1_intro',
      sort_order: 0,
      active: true,
    })
    setFormOpen(true)
  }

  const openEdit = (item: SpeakingItem) => {
    setEditing(item)
    form.setFieldsValue({
      level: item.level,
      exam_part: item.exam_part,
      topic: item.topic,
      prompt_de: item.prompt_de,
      prompt_zh: item.prompt_zh,
      expected_points: parsePoints(item.expected_points),
      target_grammar: item.target_grammar ?? [],
      ref_answer: item.ref_answer,
      error_note: item.error_note,
      sort_order: item.sort_order,
      active: item.active,
    })
    setFormOpen(true)
  }

  const saveItem = async (payload: Omit<SpeakingItem, 'item_key' | 'created_at' | 'updated_at'>) => {
    if (editing) {
      await api.updateSpeakingItem(editing.item_key, payload)
      message.success('口语题目已更新')
    } else {
      await api.createSpeakingItem(payload)
      message.success('口语题目已创建')
    }
    setFormOpen(false)
    setRefreshTick((t) => t + 1)
  }

  const handleSubmit = async () => {
    let payload: Omit<SpeakingItem, 'item_key' | 'created_at' | 'updated_at'>
    try {
      const values = await form.validateFields()
      payload = {
        lang: editing?.lang ?? 'de',
        level: values.level,
        exam_part: values.exam_part,
        topic: values.topic.trim(),
        role: editing?.role ?? 'examiner',
        prompt_de: values.prompt_de.trim(),
        prompt_zh: values.prompt_zh?.trim() ?? '',
        expected_points: JSON.stringify(values.expected_points ?? []),
        target_grammar: values.target_grammar ?? [],
        ref_answer: values.ref_answer?.trim() ?? '',
        error_note: values.error_note?.trim() ?? '',
        sort_order: values.sort_order ?? 0,
        active: values.active ?? true,
      }
    } catch {
      return
    }

    setSubmitting(true)
    try {
      // 配置语料到主题下时先做 LLM 校验：语法 + 是否属于该主题。
      const result = await api.validateSpeakingItem({
        lang: payload.lang,
        level: payload.level,
        topic: payload.topic,
        prompt_de: payload.prompt_de,
        prompt_zh: payload.prompt_zh,
        expected_points: payload.expected_points,
        ref_answer: payload.ref_answer,
        error_note: payload.error_note,
      })
      if (!result.ok) {
        setSubmitting(false)
        modal.confirm({
          title: 'LLM 校验未通过',
          width: 580,
          content: (
            <div>
              <p style={{ marginBottom: 8 }}>{result.reason || '语料存在语法或主题问题。'}</p>
              {result.issues.length > 0 && (
                <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
                  {result.issues.map((issue, index) => (
                    <li key={`${issue.text}-${index}`} style={{ marginBottom: 6 }}>
                      <code>{issue.text}</code>
                      {issue.correction && <> → <code>{issue.correction}</code></>}
                      {issue.reason && (
                        <span style={{ color: '#8c8c8c' }}>（{issue.reason}）</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
          okText: '仍要保存',
          okButtonProps: { danger: true },
          cancelText: '返回修改',
          onOk: async () => {
            setSubmitting(true)
            try {
              await saveItem(payload)
            } finally {
              setSubmitting(false)
            }
          },
        })
        return
      }
      await saveItem(payload)
    } catch (error) {
      message.error(
        error instanceof Error && error.name === 'ApiError' ? error.message : errorMessage(error),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item: SpeakingItem) => {
    try {
      await api.deleteSpeakingItem(item.item_key)
      message.success('已删除')
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('删除失败：' + errorMessage(error))
    }
  }

  const handleToggleActive = async (item: SpeakingItem, active: boolean) => {
    try {
      await api.updateSpeakingItem(item.item_key, {
        lang: item.lang,
        level: item.level,
        exam_part: item.exam_part,
        topic: item.topic,
        role: item.role,
        prompt_de: item.prompt_de,
        prompt_zh: item.prompt_zh,
        expected_points: item.expected_points,
        target_grammar: item.target_grammar ?? [],
        ref_answer: item.ref_answer,
        error_note: item.error_note,
        sort_order: item.sort_order,
        active,
      })
      message.success(active ? '已启用' : '已停用')
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setRefreshTick((t) => t + 1)
    }
  }

  const filtered = levelFilter === 'ALL' ? items : items.filter((it) => it.level === levelFilter)

  const columns: TableProps<SpeakingItem>['columns'] = [
    { title: '排序', dataIndex: 'sort_order', width: 70, render: (v: number) => <Tag>{v}</Tag> },
    {
      title: '等级',
      dataIndex: 'level',
      width: 80,
      render: (v: string) => {
        const color = v === 'A1' ? 'green' : v === 'A2' ? 'blue' : v === 'B1' ? 'orange' : 'red'
        return <Tag color={color}>{v}</Tag>
      },
    },
    {
      title: '题型',
      dataIndex: 'exam_part',
      width: 180,
      render: (v: string) => <Tag>{EXAM_PART_LABELS[v] ?? v}</Tag>,
    },
    { title: '话题', dataIndex: 'topic', width: 110 },
    {
      title: '德语问句',
      dataIndex: 'prompt_de',
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: '中文提示',
      dataIndex: 'prompt_zh',
      ellipsis: true,
      render: (v: string) => v || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: '要点',
      dataIndex: 'expected_points',
      width: 200,
      render: (v: string) => {
        const points = parsePoints(v)
        return points.length === 0 ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <Space size={4} wrap>
            {points.map((p) => (
              <Tag key={p}>{p}</Tag>
            ))}
          </Space>
        )
      },
    },
    {
      title: '启用',
      dataIndex: 'active',
      width: 80,
      render: (active: boolean, record: SpeakingItem) => (
        <Switch checked={active} onChange={(checked) => handleToggleActive(record, checked)} />
      ),
    },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, record: SpeakingItem) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该口语题目？"
            description="删除后 client 端将不再展示。"
            onConfirm={() => handleDelete(record)}
            okText="删除"
            cancelText="取消"
          >
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div className="page-head">
        <Typography.Title level={4} style={{ margin: 0 }}>
          口语题库
        </Typography.Title>
      </div>

      <Card
        title="题目列表"
        extra={
          <Space>
            <Select
              value={levelFilter}
              onChange={setLevelFilter}
              style={{ width: 120 }}
              options={[{ value: 'ALL', label: '全部等级' }, ...LEVEL_OPTIONS]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => setRefreshTick((t) => t + 1)}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建题目
            </Button>
          </Space>
        }
      >
        <Table<SpeakingItem>
          rowKey="item_key"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无口语题目，点击「新建题目」开始创建' }}
        />
      </Card>

      <Modal
        title={editing ? '编辑口语题目' : '新建口语题目'}
        open={formOpen}
        onOk={handleSubmit}
        onCancel={() => setFormOpen(false)}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {editing && (
            <Form.Item label="题目 Key">
              <Typography.Text code>{editing.item_key}</Typography.Text>
            </Form.Item>
          )}
          <Space size={12} style={{ width: '100%' }} align="start">
            <Form.Item
              label="等级"
              name="level"
              rules={[{ required: true, message: '请选择等级' }]}
              style={{ width: 180 }}
            >
              <Select options={LEVEL_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="题型"
              name="exam_part"
              rules={[{ required: true, message: '请选择题型' }]}
              style={{ width: 300 }}
            >
              <Select options={EXAM_PART_OPTIONS} />
            </Form.Item>
            <Form.Item label="排序" name="sort_order" style={{ width: 100 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="启用" name="active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item
            label="话题"
            name="topic"
            rules={[{ required: true, message: '请输入话题' }]}
          >
            <Input placeholder="如：Person / Reisen / Arbeit" />
          </Form.Item>

          <Form.Item
            label="考官德语问句"
            name="prompt_de"
            rules={[{ required: true, message: '请输入德语问句' }]}
          >
            <Input.TextArea rows={2} placeholder="如：Wie heißen Sie?" />
          </Form.Item>

          <Form.Item label="中文提示" name="prompt_zh">
            <Input placeholder="如：您叫什么名字？" />
          </Form.Item>

          <Form.Item
            label="期望要点"
            name="expected_points"
            extra="输入德语关键词后回车添加；用于 client 端的要点覆盖提示。"
          >
            <Select mode="tags" open={false} placeholder="如：heiße、Name ist" />
          </Form.Item>

          <Form.Item
            label="可引出语法点"
            name="target_grammar"
            extra="标注该题能自然使用的语法点；方案中的阻断型语法要求必须至少有一道题标注，否则保存时会自动降级为提示。"
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择该题能自然引出的语法点"
              options={grammarPoints.map((point) => ({
                value: point.key,
                label: `${point.label}${point.level ? ` · ${point.level}` : ''}`,
              }))}
            />
          </Form.Item>

          <Form.Item label="参考回答" name="ref_answer">
            <Input.TextArea rows={2} placeholder="如：Ich heiße Anna. / Mein Name ist Anna." />
          </Form.Item>

          <Form.Item label="语法提示" name="error_note">
            <Input.TextArea rows={2} placeholder="如：heißen 是强变化动词：ich heiße, du heißt。" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
