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
  GrammarPoint,
  GrammarRequirement,
  SpeakingExamPart,
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

const CEFR_RANK: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }

/** 语法点等级区间下限；未知等级返回 0。 */
function grammarMinRank(level: string): number {
  return level
    .split('-')
    .map((part) => CEFR_RANK[part.trim().toUpperCase()] ?? 0)
    .filter((rank) => rank > 0)
    .reduce((min, rank) => (min === 0 || rank < min ? rank : min), 0)
}

interface GrammarRequirementForm {
  // 一行可多选语法点，共用该行的次数 / 处理方式 / 提示部分
  keys: string[]
  min_uses: number
  enforce: 'block' | 'warn'
  hint_parts: string[]
  // 编辑旧方案时保留库中已不存在的语法点信息
  meta?: Record<string, Pick<GrammarRequirement, 'label' | 'source_path' | 'patterns'>>
}

interface PlanFormValues {
  level: string
  name: string
  description?: string
  sort_order: number
  active: boolean
  item_keys: string[]
  grammar_requirements?: GrammarRequirementForm[]
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
  const [examParts, setExamParts] = useState<SpeakingExamPart[]>([])
  const [grammarPoints, setGrammarPoints] = useState<GrammarPoint[]>([])
  const formLevel = Form.useWatch('level', form)
  const grammarRows = Form.useWatch('grammar_requirements', form) as
    | GrammarRequirementForm[]
    | undefined
  const selectedGrammarCount = useMemo(
    () => new Set((grammarRows ?? []).flatMap((row) => row.keys ?? [])).size,
    [grammarRows],
  )

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

  // 弹窗内按所选等级加载考试部分（用于 hint_parts 选项）与可选语法点
  useEffect(() => {
    if (!formOpen || !formLevel) {
      setExamParts([])
      setGrammarPoints([])
      return
    }
    let cancelled = false
    api
      .listSpeakingExamParts({ lang: 'de', level: formLevel, activeOnly: false })
      .then((res) => {
        if (!cancelled) setExamParts(res.parts ?? [])
      })
      .catch(() => {
        if (!cancelled) setExamParts([])
      })
    // 语法点按语种全量加载：低等级方案（如 A1）没有对应等级语法文档时也能选择
    api
      .listGrammarPoints({ lang: 'de' })
      .then((res) => {
        if (!cancelled) setGrammarPoints(res.points ?? [])
      })
      .catch(() => {
        if (!cancelled) setGrammarPoints([])
      })
    return () => {
      cancelled = true
    }
  }, [formOpen, formLevel])

  const hintPartOptions = useMemo(() => {
    if (examParts.length > 0) {
      return examParts.map((part) => ({ value: part.part_key, label: part.title }))
    }
    return Object.entries(PART_LABELS).map(([value, label]) => ({ value, label }))
  }, [examParts])

  const grammarPointOptions = useMemo(
    () =>
      grammarPoints.map((point) => ({
        value: point.key,
        label: `${point.label}${point.level ? ` · ${point.level}` : ''}${
          point.patterns.length === 0 ? '（未配置判定规则，仅可提示）' : ''
        }`,
      })),
    [grammarPoints],
  )

  const handleGrammarKeysChange = (index: number, keys: string[]) => {
    // 全方案最多 3 个语法点，超出部分直接截断
    const rows = (form.getFieldValue('grammar_requirements') ?? []) as GrammarRequirementForm[]
    const otherKeys = new Set(
      rows.flatMap((row, rowIndex) => (rowIndex === index ? [] : row.keys ?? [])),
    )
    const allowed = Math.max(0, 3 - otherKeys.size)
    const nextKeys = keys.length > allowed ? keys.slice(0, allowed) : keys
    if (nextKeys.length !== keys.length) {
      message.warning('最多配置 3 个语法点')
      form.setFieldValue(['grammar_requirements', index, 'keys'], nextKeys)
    }
    // 未配置判定规则，或语法等级高于当前方案时，整行只能作为提示
    const planRank = CEFR_RANK[String(form.getFieldValue('level') ?? '').toUpperCase()] ?? 0
    const cannotBlock = nextKeys.some((key) => {
      const point = grammarPoints.find((item) => item.key === key)
      if (!point || point.patterns.length === 0) return true
      const grammarRank = grammarMinRank(point.level)
      return planRank > 0 && grammarRank > 0 && grammarRank > planRank
    })
    if (cannotBlock) {
      form.setFieldValue(['grammar_requirements', index, 'enforce'], 'warn')
    }
  }

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
      grammar_requirements: [],
    })
    setFormOpen(true)
  }

  const openEdit = async (plan: SpeakingPlan) => {
    setEditing(plan)
    form.resetFields()
    try {
      const detail = await api.getSpeakingPlan(plan.id)
      const requirements: GrammarRequirementForm[] = (
        detail.plan.grammar_requirements ?? []
      ).map((item) => ({
        keys: [item.key],
        min_uses: item.min_uses ?? 1,
        enforce: item.enforce === 'warn' ? 'warn' : 'block',
        hint_parts: item.hint_parts ?? [],
        meta: {
          [item.key]: {
            label: item.label,
            source_path: item.source_path,
            patterns: item.patterns ?? [],
          },
        },
      }))
      form.setFieldsValue({
        level: plan.level,
        name: plan.name,
        description: plan.description,
        sort_order: plan.sort_order,
        active: plan.active,
        item_keys: detail.items.map((item) => item.item_key),
        grammar_requirements: requirements,
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
    const all = form.getFieldsValue(true) as PlanFormValues
    // 把“一行多选”展开成后端的单语法点要求；未配置判定规则时强制降级为提示
    const requirements: GrammarRequirement[] = []
    const seenKeys = new Set<string>()
    for (const row of all.grammar_requirements ?? []) {
      for (const key of row.keys ?? []) {
        if (!key || seenKeys.has(key)) continue
        seenKeys.add(key)
        const point = grammarPoints.find((item) => item.key === key)
        const fallback = row.meta?.[key]
        const patterns = point?.patterns ?? fallback?.patterns ?? []
        requirements.push({
          key,
          label: point?.label ?? fallback?.label ?? key,
          source_path: point?.source_path ?? fallback?.source_path ?? '',
          patterns,
          min_uses: row.min_uses ?? 1,
          enforce: patterns.length === 0 ? 'warn' : row.enforce === 'warn' ? 'warn' : 'block',
          hint_parts: row.hint_parts ?? [],
        })
      }
    }
    if (requirements.length > 3) {
      message.error('最多配置 3 个语法点，请减少选择')
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
      grammar_requirements: requirements,
    }
    setSubmitting(true)
    try {
      const result = editing
        ? await api.updateSpeakingPlan(editing.id, payload)
        : await api.createSpeakingPlan(payload)
      message.success(editing ? '方案已更新' : '方案已创建')
      if (result.warnings?.length) {
        message.warning(`已自动降级：${result.warnings.join('；')}`, 8)
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
      const result = await api.updateSpeakingPlan(plan.id, {
        lang: plan.lang,
        level: plan.level,
        name: plan.name,
        description: plan.description,
        active,
        sort_order: plan.sort_order,
        item_keys: detail.items.map((item) => item.item_key),
        grammar_requirements: detail.plan.grammar_requirements ?? [],
      })
      message.success(active ? '已启用' : '已停用')
      if (result.warnings?.length) {
        message.warning(`已自动降级：${result.warnings.join('；')}`, 8)
      }
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

          <Form.List name="grammar_requirements">
            {(fields, { add, remove }) => (
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span>
                    语法要求（整场任意回答达成即可，已选 {selectedGrammarCount}/3 个语法点）
                  </span>
                  <Button
                    size="small"
                    icon={<PlusOutlined />}
                    disabled={selectedGrammarCount >= 3}
                    onClick={() => add({ keys: [], min_uses: 1, enforce: 'block', hint_parts: [] })}
                  >
                    添加要求
                  </Button>
                </div>
                {fields.length === 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    未配置。配置后，未达成的语法要求会在考试中阻断推进，并进入补答流程。
                  </Typography.Text>
                )}
                {fields.map((field) => (
                  <div
                    key={field.key}
                    style={{
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      padding: '12px 12px 0',
                      marginTop: 8,
                    }}
                  >
                    <Space size={12} align="start" wrap style={{ width: '100%' }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'keys']}
                        label="语法点（可多选）"
                        rules={[{ required: true, message: '请选择语法点' }]}
                        style={{ width: 360, marginBottom: 12 }}
                      >
                        <Select
                          mode="multiple"
                          showSearch
                          optionFilterProp="label"
                          maxTagCount="responsive"
                          options={grammarPointOptions}
                          placeholder="从语法库选择，可多选"
                          onChange={(keys: string[]) => handleGrammarKeysChange(field.name, keys)}
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'min_uses']}
                        label="需完成次数"
                        style={{ width: 110, marginBottom: 12 }}
                      >
                        <InputNumber min={1} max={10} precision={0} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate>
                        {() => {
                          const keys = form.getFieldValue([
                            'grammar_requirements',
                            field.name,
                            'keys',
                          ]) as string[] | undefined
                          const planRank =
                            CEFR_RANK[String(form.getFieldValue('level') ?? '').toUpperCase()] ?? 0
                          const lacksPatterns =
                            !Array.isArray(keys) ||
                            keys.length === 0 ||
                            keys.some((key) => {
                              const point = grammarPoints.find((item) => item.key === key)
                              if (!point || point.patterns.length === 0) return true
                              const grammarRank = grammarMinRank(point.level)
                              return planRank > 0 && grammarRank > 0 && grammarRank > planRank
                            })
                          return (
                            <Form.Item
                              {...field}
                              name={[field.name, 'enforce']}
                              label="未达成处理"
                              style={{ width: 140, marginBottom: 12 }}
                            >
                              <Select
                                options={[
                                  { value: 'block', label: '阻断推进', disabled: lacksPatterns },
                                  { value: 'warn', label: '仅提示' },
                                ]}
                              />
                            </Form.Item>
                          )
                        }}
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'hint_parts']}
                        label="建议出现部分（仅提示）"
                        style={{ minWidth: 220, flex: 1, marginBottom: 12 }}
                      >
                        <Select
                          mode="multiple"
                          allowClear
                          options={hintPartOptions}
                          placeholder="可选"
                        />
                      </Form.Item>
                      <Button
                        danger
                        type="link"
                        icon={<DeleteOutlined />}
                        style={{ marginTop: 30 }}
                        onClick={() => remove(field.name)}
                      >
                        移除
                      </Button>
                    </Space>
                    <Form.Item noStyle shouldUpdate>
                      {() => {
                        const keys = form.getFieldValue([
                          'grammar_requirements',
                          field.name,
                          'keys',
                        ]) as string[] | undefined
                        if (!Array.isArray(keys) || keys.length === 0) return null
                        const planRank =
                          CEFR_RANK[String(form.getFieldValue('level') ?? '').toUpperCase()] ?? 0
                        const missingPatterns = keys.filter((key) => {
                          const point = grammarPoints.find((item) => item.key === key)
                          return !point || point.patterns.length === 0
                        })
                        const tooHigh = keys.filter((key) => {
                          const point = grammarPoints.find((item) => item.key === key)
                          if (!point) return false
                          const grammarRank = grammarMinRank(point.level)
                          return planRank > 0 && grammarRank > 0 && grammarRank > planRank
                        })
                        if (missingPatterns.length === 0 && tooHigh.length === 0) return null
                        return (
                          <div style={{ fontSize: 12, color: '#B9770E', margin: '-4px 0 10px' }}>
                            {missingPatterns.length > 0 &&
                              `所选语法点中「${missingPatterns.join('、')}」尚未配置判定规则。`}
                            {tooHigh.length > 0 &&
                              `所选语法点中「${tooHigh.join('、')}」等级高于当前方案。`}
                            整行只能作为提示。
                          </div>
                        )
                      }}
                    </Form.Item>
                  </div>
                ))}
              </div>
            )}
          </Form.List>
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
