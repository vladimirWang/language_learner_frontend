import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, RobotOutlined } from '@ant-design/icons'
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
import { useEffect, useMemo, useState } from 'react'
import { api, errorMessage } from '../api'
import type {
  SpeakingItem,
  SpeakingPlan,
  SpeakingPlanGeneratedEntry,
  SpeakingPlanGenerateResponse,
  SpeakingPlanInput,
} from '../types'

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((value) => ({
  value,
  label: value,
}))

const PART_LABELS: Record<string, string> = {
  part1_intro: '第一部分',
  part2_presentation: '第二部分',
  part3_discussion: '第三部分',
}

interface PlanFormValues {
  level: string
  name: string
  description?: string
  sort_order: number
  active: boolean
  item_keys: string[]
}

interface GenerateFormValues {
  level: string
  name: string
  description: string
  item_count: number
}

export default function SpeakingPlansPage() {
  const { message } = AntApp.useApp()

  const [plans, setPlans] = useState<SpeakingPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [levelFilter, setLevelFilter] = useState('ALL')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SpeakingPlan | null>(null)
  const [form] = Form.useForm<PlanFormValues>()
  const [submitting, setSubmitting] = useState(false)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateForm] = Form.useForm<GenerateFormValues>()
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [generated, setGenerated] = useState<SpeakingPlanGenerateResponse | null>(null)

  const [items, setItems] = useState<SpeakingItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const formLevel = Form.useWatch('level', form)

  const loadPlans = async () => {
    setLoading(true)
    try {
      const res = await api.listSpeakingPlans({ lang: 'de', activeOnly: false })
      setPlans(res.plans ?? [])
    } catch (error) {
      message.error('加载口语方案失败：' + errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPlans()
  }, [refreshTick])

  // 弹窗内按所选等级加载可选题目
  useEffect(() => {
    if (!formOpen || !formLevel) {
      setItems([])
      return
    }
    let cancelled = false
    setLoadingItems(true)
    api
      .listSpeakingItems({ lang: 'de', level: formLevel, activeOnly: false })
      .then((res) => {
        if (!cancelled) setItems(res.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false)
      })
    return () => {
      cancelled = true
    }
  }, [formOpen, formLevel])

  const itemOptions = useMemo(() => {
    const groups = new Map<string, { label: string; value: string }[]>()
    for (const item of items) {
      const part = PART_LABELS[item.exam_part] ?? item.exam_part
      const label = `${part} · ${item.topic} · ${item.prompt_de}${item.active ? '' : '（已停用）'}`
      const list = groups.get(part) ?? []
      list.push({ label, value: item.item_key })
      groups.set(part, list)
    }
    return [...groups.entries()].map(([label, options]) => ({ label, options }))
  }, [items])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      level: 'A1',
      name: '',
      description: '',
      sort_order: 0,
      active: true,
      item_keys: [],
    })
    setFormOpen(true)
  }

  const openEdit = async (plan: SpeakingPlan) => {
    setEditing(plan)
    form.resetFields()
    try {
      const detail = await api.getSpeakingPlan(plan.id)
      form.setFieldsValue({
        level: plan.level,
        name: plan.name,
        description: plan.description,
        sort_order: plan.sort_order,
        active: plan.active,
        item_keys: detail.items.map((item) => item.item_key),
      })
      setFormOpen(true)
    } catch (error) {
      message.error('加载方案详情失败：' + errorMessage(error))
    }
  }

  const handleSubmit = async () => {
    let values: PlanFormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const payload: SpeakingPlanInput = {
      lang: editing?.lang ?? 'de',
      level: values.level,
      name: values.name.trim(),
      description: values.description?.trim() ?? '',
      active: values.active ?? true,
      sort_order: values.sort_order ?? 0,
      item_keys: values.item_keys ?? [],
    }
    setSubmitting(true)
    try {
      if (editing) {
        await api.updateSpeakingPlan(editing.id, payload)
        message.success('方案已更新')
      } else {
        await api.createSpeakingPlan(payload)
        message.success('方案已创建')
      }
      setFormOpen(false)
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('保存失败：' + errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const openGenerate = () => {
    generateForm.resetFields()
    generateForm.setFieldsValue({ level: 'A1', name: '', description: '', item_count: 6 })
    setGenerated(null)
    setGenerateError('')
    setGenerateOpen(true)
  }

  const closeGenerate = () => {
    if (generating) return
    setGenerateOpen(false)
    setGenerated(null)
    setGenerateError('')
  }

  const handleGenerate = async () => {
    let values: GenerateFormValues
    try {
      values = await generateForm.validateFields()
    } catch {
      return
    }
    setGenerating(true)
    setGenerateError('')
    try {
      const result = await api.generateSpeakingPlan({
        lang: 'de',
        level: values.level,
        name: values.name.trim(),
        description: values.description.trim(),
        item_count: values.item_count,
      })
      setGenerated(result)
      setRefreshTick((tick) => tick + 1)
      message.success('方案已生成，请审核预览内容')
    } catch (error) {
      setGenerateError(errorMessage(error))
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (plan: SpeakingPlan) => {
    try {
      await api.deleteSpeakingPlan(plan.id)
      message.success('已删除')
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('删除失败：' + errorMessage(error))
    }
  }

  const handleToggleActive = async (plan: SpeakingPlan, active: boolean) => {
    try {
      const detail = await api.getSpeakingPlan(plan.id)
      await api.updateSpeakingPlan(plan.id, {
        lang: plan.lang,
        level: plan.level,
        name: plan.name,
        description: plan.description,
        active,
        sort_order: plan.sort_order,
        item_keys: detail.items.map((item) => item.item_key),
      })
      message.success(active ? '已启用' : '已停用')
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setRefreshTick((t) => t + 1)
    }
  }

  const filtered =
    levelFilter === 'ALL' ? plans : plans.filter((plan) => plan.level === levelFilter)

  const columns: TableProps<SpeakingPlan>['columns'] = [
    {
      title: '等级',
      dataIndex: 'level',
      width: 80,
      render: (v: string) => <Tag color={v === 'A1' ? 'green' : 'blue'}>{v}</Tag>,
    },
    { title: '方案名称', dataIndex: 'name' },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    {
      title: '题目数',
      dataIndex: 'item_count',
      width: 90,
      render: (v: number) => `${v} 题`,
    },
    { title: '排序', dataIndex: 'sort_order', width: 70 },
    {
      title: '启用',
      dataIndex: 'active',
      width: 80,
      render: (active: boolean, record: SpeakingPlan) => (
        <Switch checked={active} onChange={(checked) => handleToggleActive(record, checked)} />
      ),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: SpeakingPlan) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该方案？"
            description="已加入关卡的口语入口会失去题目。"
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
          口语方案
        </Typography.Title>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="方案由同一难度下的若干口语题目组成。关卡配置里的口语入口改为选择一个方案，进入考试时只抽取该方案内的题目。"
      />

      <Card
        title="方案列表"
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
            <Button icon={<RobotOutlined />} onClick={openGenerate}>
              智能生成
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建方案
            </Button>
          </Space>
        }
      >
        <Table<SpeakingPlan>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无口语方案' }}
        />
      </Card>

      <Modal
        title={editing ? '编辑口语方案' : '新建口语方案'}
        open={formOpen}
        onOk={handleSubmit}
        onCancel={() => setFormOpen(false)}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        width={820}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space size={12} style={{ width: '100%' }} align="start">
            <Form.Item
              label="等级"
              name="level"
              rules={[{ required: true, message: '请选择等级' }]}
              style={{ width: 140 }}
            >
              <Select options={LEVEL_OPTIONS} />
            </Form.Item>
            <Form.Item
              label="方案名称"
              name="name"
              rules={[{ required: true, message: '请输入方案名称' }]}
              style={{ width: 260 }}
            >
              <Input placeholder="如：A1 官方流程 · 完整卷" />
            </Form.Item>
            <Form.Item label="排序" name="sort_order" style={{ width: 90 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="启用" name="active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item label="说明" name="description">
            <Input placeholder="可选，说明该方案的用途或来源" />
          </Form.Item>

          <Form.Item
            label="题目（按选择顺序出题）"
            name="item_keys"
            rules={[{ required: true, message: '至少选择一道题目' }]}
            extra="列出当前等级下的全部口语题目并标注停用状态；启用方案前需先启用所有题目。"
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              loading={loadingItems}
              options={itemOptions}
              placeholder="从题库中选择题目"
              maxTagCount="responsive"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={generated ? '智能组卷预览' : '智能生成口语方案'}
        open={generateOpen}
        onOk={handleGenerate}
        onCancel={closeGenerate}
        confirmLoading={generating}
        okText="开始生成"
        cancelText="取消"
        cancelButtonProps={{ disabled: generating }}
        closable={!generating}
        maskClosable={false}
        keyboard={!generating}
        width={generated ? 1080 : 640}
        destroyOnClose
        footer={
          generated ? (
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={closeGenerate}>完成</Button>
                <Button
                  type="primary"
                  onClick={() => {
                    const plan = generated.plan
                    closeGenerate()
                    void openEdit(plan)
                  }}
                >
                  编辑方案
                </Button>
              </Space>
            </div>
          ) : undefined
        }
      >
        {generated ? (
          <div>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="方案和新生成题目均已默认停用"
              description="请先在口语题库审核并启用新题，再回到方案列表启用方案。未启用所有关联题目前，方案无法启用。"
            />
            {generated.warnings.length > 0 && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="生成提示"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {generated.warnings.map((warning, index) => (
                      <li key={`${index}-${warning}`}>{warning}</li>
                    ))}
                  </ul>
                }
              />
            )}
            <Typography.Title level={5}>{generated.plan.name}</Typography.Title>
            <Table<SpeakingPlanGeneratedEntry>
              rowKey={(entry) => entry.item.item_key}
              dataSource={generated.entries}
              pagination={false}
              size="small"
              scroll={{ x: 1000 }}
              columns={[
                { title: '序号', dataIndex: 'position', width: 60 },
                {
                  title: '来源',
                  dataIndex: 'source',
                  width: 80,
                  render: (source) =>
                    source === 'existing' ? <Tag color="blue">现有题</Tag> : <Tag color="purple">新题</Tag>,
                },
                {
                  title: '部分',
                  width: 100,
                  render: (_, entry) => PART_LABELS[entry.item.exam_part] ?? entry.item.exam_part,
                },
                { title: '话题', width: 130, render: (_, entry) => entry.item.topic },
                { title: '问句', width: 360, render: (_, entry) => entry.item.prompt_de },
                {
                  title: '状态',
                  width: 90,
                  render: (_, entry) =>
                    entry.item.active ? <Tag color="green">已启用</Tag> : <Tag>已停用</Tag>,
                },
              ]}
            />
          </div>
        ) : (
          <>
            <Alert
              type="info"
              showIcon
              message="优先选择题库中的现有题，说明中未覆盖的内容会自动补题。生成后可在此预览审核。"
              style={{ marginBottom: 16 }}
            />
            {generateError && (
              <Alert type="error" showIcon message="生成失败" description={generateError} style={{ marginBottom: 16 }} />
            )}
            <Form form={generateForm} layout="vertical">
              <Space size={12} align="start">
                <Form.Item
                  label="等级"
                  name="level"
                  rules={[{ required: true, message: '请选择等级' }]}
                  style={{ width: 140 }}
                >
                  <Select options={LEVEL_OPTIONS} />
                </Form.Item>
                <Form.Item
                  label="方案名称"
                  name="name"
                  rules={[{ required: true, message: '请输入方案名称' }]}
                  style={{ width: 300 }}
                >
                  <Input maxLength={100} placeholder="如：B1 环境主题综合练习" />
                </Form.Item>
                <Form.Item
                  label="题数"
                  name="item_count"
                  rules={[{ required: true, message: '请输入题数' }]}
                >
                  <InputNumber min={1} max={10} precision={0} style={{ width: 90 }} />
                </Form.Item>
              </Space>
              <Form.Item
                label="方案说明"
                name="description"
                rules={[{ required: true, whitespace: true, message: '请说明组卷目标和需要覆盖的内容' }]}
                extra="请描述话题、考试部分和希望覆盖的能力；系统会据此选题并补充缺失题目。"
              >
                <Input.TextArea
                  rows={5}
                  maxLength={2000}
                  showCount
                  placeholder="如：围绕日常生活与环境保护，包含个人情况问答和观点讨论，优选题库已有内容。"
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  )
}
