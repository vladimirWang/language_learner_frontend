import {
  DeleteOutlined,
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Alert,
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
import type { ExamAid, SpeakingExamPart, SpeakingExamPartInput } from '../types'

const LEVEL_OPTIONS = [
  { value: 'A1', label: 'A1 - 入门' },
  { value: 'A2', label: 'A2 - 初级' },
]

const PART_OPTIONS = [
  { value: 'part1_intro', label: '第一部分' },
  { value: 'part2_presentation', label: '第二部分' },
  { value: 'part3_discussion', label: '第三部分' },
]

const PART_LABELS: Record<string, string> = Object.fromEntries(
  PART_OPTIONS.map((o) => [o.value, o.label]),
)

const MODE_OPTIONS = [
  { value: 'intro', label: '自我介绍' },
  { value: 'qa', label: '问答' },
  { value: 'request', label: '请求互动' },
  { value: 'monologue', label: '简短自述' },
  { value: 'planning', label: '共同规划' },
  { value: 'presentation', label: '主题陈述' },
  { value: 'discussion', label: '双人讨论' },
]

const MODE_LABELS: Record<string, string> = Object.fromEntries(
  MODE_OPTIONS.map((o) => [o.value, o.label]),
)

const ROLE_OPTIONS = [
  { value: 'examiner', label: '考官' },
  { value: 'partner', label: '语伴' },
]

const AID_KIND_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'chips', label: '关键词' },
  { value: 'cards', label: '题卡' },
  { value: 'mindmap', label: '思维导图' },
  { value: 'schedule', label: '双人日程' },
]

const AID_KIND_LABELS: Record<string, string> = Object.fromEntries(
  AID_KIND_OPTIONS.map((o) => [o.value, o.label]),
)

interface ExamPartFormValues {
  level: string
  part_key: string
  title: string
  mode: string
  duration_sec: number
  max_followups: number
  role: string
  sort_order: number
  active: boolean
  aid_kind: 'none' | 'chips' | 'cards' | 'mindmap' | 'schedule'
  aid_label?: string
  aid_items?: string[]
  aid_cards?: { title: string; hint?: string }[]
  aid_center?: string
  aid_branches?: string[]
  aid_groups?: { name: string; slots: string[] }[]
}

/** 把一条配置还原成请求体（切换启用状态时复用）。 */
function partToPayload(part: SpeakingExamPart): SpeakingExamPartInput {
  return {
    lang: part.lang,
    level: part.level,
    part_key: part.part_key,
    title: part.title,
    mode: part.mode,
    duration_sec: part.duration_sec,
    max_followups: part.max_followups,
    role: part.role,
    aid: part.aid,
    sort_order: part.sort_order,
    active: part.active,
  }
}

/** 按表单里的 aid_kind 组装辅助材料 JSON。 */
function buildAid(values: ExamPartFormValues): ExamAid | null {
  const label = values.aid_label?.trim() ?? ''
  switch (values.aid_kind) {
    case 'chips':
      return { kind: 'chips', label, items: values.aid_items ?? [] }
    case 'cards':
      return {
        kind: 'cards',
        label,
        cards: (values.aid_cards ?? []).map((card) => ({
          title: card.title ?? '',
          hint: card.hint ?? '',
        })),
      }
    case 'mindmap':
      return {
        kind: 'mindmap',
        label,
        center: values.aid_center?.trim() ?? '',
        branches: values.aid_branches ?? [],
      }
    case 'schedule':
      return {
        kind: 'schedule',
        label,
        groups: (values.aid_groups ?? []).map((group) => ({
          name: group.name ?? '',
          slots: group.slots ?? [],
        })),
      }
    default:
      return null
  }
}

export default function SpeakingExamPartsPage() {
  const { message } = AntApp.useApp()

  const [parts, setParts] = useState<SpeakingExamPart[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [levelFilter, setLevelFilter] = useState('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SpeakingExamPart | null>(null)
  const [form] = Form.useForm<ExamPartFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const aidKind = Form.useWatch('aid_kind', form)

  const loadParts = async () => {
    setLoading(true)
    try {
      const res = await api.listSpeakingExamParts({ lang: 'de', activeOnly: false })
      setParts(res.parts ?? [])
    } catch (error) {
      message.error('加载考试配置失败：' + errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadParts()
  }, [refreshTick])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    const nextSort =
      parts.filter((p) => p.level === 'A1').reduce((max, p) => Math.max(max, p.sort_order), 0) + 1
    form.setFieldsValue({
      level: 'A1',
      part_key: 'part1_intro',
      title: '',
      mode: 'intro',
      duration_sec: 180,
      max_followups: 0,
      role: 'examiner',
      sort_order: nextSort,
      active: true,
      aid_kind: 'none',
      aid_label: '',
      aid_items: [],
      aid_cards: [],
      aid_center: '',
      aid_branches: [],
      aid_groups: [],
    })
    setFormOpen(true)
  }

  const openEdit = (part: SpeakingExamPart) => {
    setEditing(part)
    form.resetFields()
    const aid = part.aid
    form.setFieldsValue({
      level: part.level,
      part_key: part.part_key,
      title: part.title,
      mode: part.mode,
      duration_sec: part.duration_sec,
      max_followups: part.max_followups,
      role: part.role,
      sort_order: part.sort_order,
      active: part.active,
      aid_kind: aid?.kind ?? 'none',
      aid_label: aid?.label ?? '',
      aid_items: aid?.kind === 'chips' ? aid.items : [],
      aid_cards: aid?.kind === 'cards' ? aid.cards : [],
      aid_center: aid?.kind === 'mindmap' ? aid.center : '',
      aid_branches: aid?.kind === 'mindmap' ? aid.branches : [],
      aid_groups: aid?.kind === 'schedule' ? aid.groups : [],
    })
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    let values: ExamPartFormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const payload: SpeakingExamPartInput = {
      lang: editing?.lang ?? 'de',
      level: values.level,
      part_key: values.part_key,
      title: values.title.trim(),
      mode: values.mode,
      duration_sec: values.duration_sec,
      max_followups: values.max_followups,
      role: values.role,
      aid: buildAid(values),
      sort_order: values.sort_order ?? 0,
      active: values.active ?? true,
    }
    setSubmitting(true)
    try {
      if (editing) {
        await api.updateSpeakingExamPart(editing.id, payload)
        message.success('考试配置已更新')
      } else {
        await api.createSpeakingExamPart(payload)
        message.success('考试配置已创建')
      }
      setFormOpen(false)
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('保存失败：' + errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (part: SpeakingExamPart) => {
    try {
      await api.deleteSpeakingExamPart(part.id)
      message.success('已删除')
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('删除失败：' + errorMessage(error))
    }
  }

  const handleToggleActive = async (part: SpeakingExamPart, active: boolean) => {
    try {
      await api.updateSpeakingExamPart(part.id, { ...partToPayload(part), active })
      message.success(active ? '已启用' : '已停用')
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setRefreshTick((t) => t + 1)
    }
  }

  const filtered =
    levelFilter === 'ALL' ? parts : parts.filter((part) => part.level === levelFilter)

  const columns: TableProps<SpeakingExamPart>['columns'] = [
    { title: '排序', dataIndex: 'sort_order', width: 70, render: (v: number) => <Tag>{v}</Tag> },
    {
      title: '等级',
      dataIndex: 'level',
      width: 80,
      render: (v: string) => <Tag color={v === 'A1' ? 'green' : 'blue'}>{v}</Tag>,
    },
    {
      title: '部分',
      dataIndex: 'part_key',
      width: 100,
      render: (v: string) => <Tag>{PART_LABELS[v] ?? v}</Tag>,
    },
    { title: '标题', dataIndex: 'title', width: 150 },
    {
      title: '交互模式',
      dataIndex: 'mode',
      width: 110,
      render: (v: string) => <Tag color="processing">{MODE_LABELS[v] ?? v}</Tag>,
    },
    {
      title: '时长',
      dataIndex: 'duration_sec',
      width: 90,
      render: (v: number) => `${v} 秒`,
    },
    {
      title: '追问',
      dataIndex: 'max_followups',
      width: 80,
      render: (v: number) => `${v} 次`,
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 80,
      render: (v: string) => <Tag>{v === 'partner' ? '语伴' : '考官'}</Tag>,
    },
    {
      title: '辅助材料',
      dataIndex: 'aid',
      width: 110,
      render: (aid: ExamAid | null) =>
        aid ? <Tag color="gold">{AID_KIND_LABELS[aid.kind] ?? aid.kind}</Tag> : '—',
    },
    {
      title: '启用',
      dataIndex: 'active',
      width: 80,
      render: (active: boolean, record: SpeakingExamPart) => (
        <Switch checked={active} onChange={(checked) => handleToggleActive(record, checked)} />
      ),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: SpeakingExamPart) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该部分配置？"
            description="删除后 client 端该部分将不再出现。"
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
          口语考试配置
        </Typography.Title>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="A1/A2 歌德口试的流程由这里的结构驱动：每个等级的三部分时长、追问次数、角色与题卡/思维导图/日程。具体问句请到「口语题库」按等级和部分维护。"
      />

      <Card
        title="考试部分"
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
              新建部分
            </Button>
          </Space>
        }
      >
        <Table<SpeakingExamPart>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无考试部分配置' }}
        />
      </Card>

      <Modal
        title={editing ? '编辑考试部分' : '新建考试部分'}
        open={formOpen}
        onOk={handleSubmit}
        onCancel={() => setFormOpen(false)}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space size={12} style={{ width: '100%' }} align="start" wrap>
            <Form.Item
              label="等级"
              name="level"
              rules={[{ required: true, message: '请选择等级' }]}
              style={{ width: 140 }}
            >
              <Select options={LEVEL_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="部分"
              name="part_key"
              rules={[{ required: true, message: '请选择部分' }]}
              style={{ width: 140 }}
            >
              <Select options={PART_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="交互模式"
              name="mode"
              rules={[{ required: true, message: '请选择交互模式' }]}
              style={{ width: 140 }}
            >
              <Select options={MODE_OPTIONS} />
            </Form.Item>
            <Form.Item label="角色" name="role" style={{ width: 110 }}>
              <Select options={ROLE_OPTIONS} />
            </Form.Item>
            <Form.Item label="排序" name="sort_order" style={{ width: 90 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="启用" name="active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="如：自我介绍 / 日常问答 / 请求互动" />
          </Form.Item>

          <Space size={12} style={{ width: '100%' }} align="start">
            <Form.Item
              label="时长（秒）"
              name="duration_sec"
              rules={[{ required: true, message: '请输入时长' }]}
              style={{ width: 160 }}
            >
              <InputNumber min={30} max={3600} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="追问次数" name="max_followups" style={{ width: 140 }}>
              <InputNumber min={0} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item label="辅助材料" name="aid_kind" style={{ width: 180 }}>
            <Select options={AID_KIND_OPTIONS} />
          </Form.Item>

          {aidKind && aidKind !== 'none' && (
            <>
              <Form.Item
                label="材料标题"
                name="aid_label"
                rules={[{ required: true, message: '请输入材料标题' }]}
              >
                <Input placeholder="如：抽一张卡，围绕卡片简短问答" />
              </Form.Item>

              {aidKind === 'chips' && (
                <Form.Item label="关键词" name="aid_items" extra="输入后回车添加。">
                  <Select mode="tags" open={false} placeholder="如：Name、Alter、Land" />
                </Form.Item>
              )}

              {aidKind === 'cards' && (
                <Form.Item label="题卡">
                  <Form.List name="aid_cards">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map((field) => (
                          <Space key={field.key} align="baseline" style={{ display: 'flex' }}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'title']}
                              rules={[{ required: true, message: '请输入卡片标题' }]}
                              style={{ marginBottom: 8 }}
                            >
                              <Input placeholder="卡片标题，如：Essen" style={{ width: 220 }} />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'hint']}
                              style={{ marginBottom: 8 }}
                            >
                              <Input placeholder="提示，如：吃什么、是否自己做饭" style={{ width: 320 }} />
                            </Form.Item>
                            <MinusCircleOutlined onClick={() => remove(field.name)} />
                          </Space>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({ title: '', hint: '' })}
                        >
                          添加题卡
                        </Button>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
              )}

              {aidKind === 'mindmap' && (
                <>
                  <Form.Item label="中心词" name="aid_center">
                    <Input placeholder="如：Geld" />
                  </Form.Item>
                  <Form.Item label="分支" name="aid_branches" extra="输入后回车添加。">
                    <Select mode="tags" open={false} placeholder="如：Kleidung、Miete、Reisen" />
                  </Form.Item>
                </>
              )}

              {aidKind === 'schedule' && (
                <Form.Item label="双方日程">
                  <Form.List name="aid_groups">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map((field) => (
                          <Space key={field.key} align="baseline" style={{ display: 'flex' }}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'name']}
                              rules={[{ required: true, message: '请输入日程名称' }]}
                              style={{ marginBottom: 8 }}
                            >
                              <Input placeholder="名称，如：Sie" style={{ width: 160 }} />
                            </Form.Item>
                            <Form.Item
                              {...field}
                              name={[field.name, 'slots']}
                              style={{ marginBottom: 8, width: 440 }}
                            >
                              <Select
                                mode="tags"
                                open={false}
                                placeholder="时间段，如：10:00 Deutschkurs"
                              />
                            </Form.Item>
                            <MinusCircleOutlined onClick={() => remove(field.name)} />
                          </Space>
                        ))}
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => add({ name: '', slots: [] })}
                        >
                          添加日程组
                        </Button>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
              )}
            </>
          )}
        </Form>
      </Modal>
    </div>
  )
}
