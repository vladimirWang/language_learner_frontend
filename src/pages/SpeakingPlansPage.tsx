import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
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
import type { SpeakingItem, SpeakingPlan, SpeakingPlanInput } from '../types'

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
      .listSpeakingItems({ lang: 'de', level: formLevel })
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
      const label = `${part} · ${item.topic} · ${item.prompt_de}`
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
            extra="只列出当前等级下已启用的口语题目；如需调整顺序，可在题库里修改排序。"
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
    </div>
  )
}
