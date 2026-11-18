import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
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
import type { SpeakingReplyTemplate } from '../types'

const EXAM_PART_OPTIONS = [
  { value: 'part1_intro', label: '第一部分 · 自我介绍与问答' },
  { value: 'part2_presentation', label: '第二部分 · 主题陈述' },
  { value: 'part3_discussion', label: '第三部分 · 双人讨论' },
]

const EXAM_PART_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_PART_OPTIONS.map((o) => [o.value, o.label]),
)

const ROLE_OPTIONS = [
  { value: 'examiner', label: '考官' },
  { value: 'partner', label: '搭档' },
]

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((o) => [o.value, o.label]),
)

interface TemplateFormValues {
  exam_part: string
  role: string
  text: string
  sort_order: number
  active: boolean
}

export default function SpeakingTemplatesPage() {
  const { message } = AntApp.useApp()

  const [items, setItems] = useState<SpeakingReplyTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SpeakingReplyTemplate | null>(null)
  const [form] = Form.useForm<TemplateFormValues>()
  const [submitting, setSubmitting] = useState(false)

  const loadItems = async () => {
    setLoading(true)
    try {
      const res = await api.listSpeakingTemplates()
      setItems(res.templates ?? [])
    } catch (error) {
      message.error('加载兜底话术失败：' + errorMessage(error))
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
      exam_part: 'part1_intro',
      role: 'examiner',
      sort_order: 0,
      active: true,
    })
    setFormOpen(true)
  }

  const openEdit = (item: SpeakingReplyTemplate) => {
    setEditing(item)
    form.setFieldsValue({
      exam_part: item.exam_part,
      role: item.role,
      text: item.text,
      sort_order: item.sort_order,
      active: item.active,
    })
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        exam_part: values.exam_part,
        role: values.role,
        text: values.text.trim(),
        sort_order: values.sort_order ?? 0,
        active: values.active ?? true,
      }
      if (editing) {
        await api.updateSpeakingTemplate(editing.id, payload)
        message.success('话术已更新')
      } else {
        await api.createSpeakingTemplate(payload)
        message.success('话术已创建')
      }
      setFormOpen(false)
      setRefreshTick((t) => t + 1)
    } catch (error) {
      if (error instanceof Error && error.name === 'ApiError') {
        message.error(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item: SpeakingReplyTemplate) => {
    try {
      await api.deleteSpeakingTemplate(item.id)
      message.success('已删除')
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('删除失败：' + errorMessage(error))
    }
  }

  const handleToggleActive = async (item: SpeakingReplyTemplate, active: boolean) => {
    try {
      await api.updateSpeakingTemplate(item.id, {
        exam_part: item.exam_part,
        role: item.role,
        text: item.text,
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

  const columns: TableProps<SpeakingReplyTemplate>['columns'] = [
    { title: '排序', dataIndex: 'sort_order', width: 70, render: (v: number) => <Tag>{v}</Tag> },
    {
      title: '部分',
      dataIndex: 'exam_part',
      width: 200,
      render: (v: string) => <Tag>{EXAM_PART_LABELS[v] ?? v}</Tag>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 80,
      render: (v: string) => <Tag color={v === 'partner' ? 'purple' : 'blue'}>{ROLE_LABELS[v] ?? v}</Tag>,
    },
    {
      title: '话术',
      dataIndex: 'text',
      render: (v: string) => <Typography.Text>{v}</Typography.Text>,
    },
    {
      title: '状态',
      dataIndex: 'active',
      width: 90,
      render: (v: boolean, record) => (
        <Switch size="small" checked={v} onChange={(checked) => handleToggleActive(record, checked)} />
      ),
    },
    {
      title: '操作',
      width: 130,
      render: (_: unknown, record) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该话术？"
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
    <Card
      title="口语兜底话术"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshTick((t) => t + 1)}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建话术
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        大模型不可用、输出不合规或与历史重复时，问候语与追问从这里取。按「部分 + 角色」轮转，已问过的句子会跳过；表为空或全部停用时回退代码内默认话术。
      </Typography.Paragraph>
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />

      <Modal
        title={editing ? '编辑话术' : '新建话术'}
        open={formOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setFormOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ exam_part: 'part1_intro', role: 'examiner', active: true }}>
          <Form.Item name="exam_part" label="部分" rules={[{ required: true, message: '请选择部分' }]}>
            <Select options={EXAM_PART_OPTIONS} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="text" label="德语话术" rules={[{ required: true, message: '请输入德语话术' }]}>
            <Input.TextArea rows={3} maxLength={300} showCount placeholder="z. B. Können Sie das bitte genauer sagen?" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} max={9999} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
