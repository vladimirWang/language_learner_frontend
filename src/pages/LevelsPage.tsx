import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  App as AntApp,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  type TableProps,
} from 'antd'
import { useEffect, useState } from 'react'
import { api, errorMessage, formatTime } from '../api'
import { LANGS, langLabel, type AvailableExam, type Level, type LevelExam } from '../types'

export default function LevelsPage() {
  const { message } = AntApp.useApp()

  const [levels, setLevels] = useState<Level[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  // 新建/编辑 Modal
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Level | null>(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // 管理 exam Drawer
  const [examDrawerOpen, setExamDrawerOpen] = useState(false)
  const [activeLevel, setActiveLevel] = useState<Level | null>(null)
  const [linkedExams, setLinkedExams] = useState<LevelExam[]>([])
  const [availableExams, setAvailableExams] = useState<AvailableExam[]>([])
  const [loadingExams, setLoadingExams] = useState(false)
  const [addingExam, setAddingExam] = useState<string | null>(null)

  const loadLevels = async () => {
    setLoading(true)
    try {
      const res = await api.listLevels()
      setLevels(res.levels)
    } catch (error) {
      message.error('加载关卡失败：' + errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadLevels()
  }, [refreshTick])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ lang: 'de', sort_order: 0 })
    setFormOpen(true)
  }

  const openEdit = (lv: Level) => {
    setEditing(lv)
    form.setFieldsValue({ name: lv.name, description: lv.description, sort_order: lv.sort_order })
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (editing) {
        await api.updateLevel(editing.id, values)
        message.success('关卡已更新')
      } else {
        await api.createLevel(values)
        message.success('关卡已创建')
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

  const handleDelete = async (lv: Level) => {
    try {
      await api.deleteLevel(lv.id)
      message.success(`关卡「${lv.name}」已删除`)
      setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('删除失败：' + errorMessage(error))
    }
  }

  const openExamDrawer = async (lv: Level) => {
    setActiveLevel(lv)
    setExamDrawerOpen(true)
    setLinkedExams([])
    setAvailableExams([])
    setLoadingExams(true)
    try {
      const [detail, avail] = await Promise.all([api.levelDetail(lv.id), api.availableExams(lv.id)])
      setLinkedExams(detail.exams ?? [])
      setAvailableExams(avail.exams ?? [])
    } catch (error) {
      message.error('加载 exam 列表失败：' + errorMessage(error))
    } finally {
      setLoadingExams(false)
    }
  }

  const refreshExams = async () => {
    if (!activeLevel) return
    try {
      const [detail, avail] = await Promise.all([
        api.levelDetail(activeLevel.id),
        api.availableExams(activeLevel.id),
      ])
      setLinkedExams(detail.exams ?? [])
      setAvailableExams(avail.exams ?? [])
    } catch (error) {
      message.error('刷新失败：' + errorMessage(error))
    }
  }

  const handleAddExam = async (examId: string) => {
    if (!activeLevel) return
    setAddingExam(examId)
    try {
      const sortOrder = linkedExams.length
      await api.addLevelExam(activeLevel.id, examId, sortOrder)
      message.success('已添加到关卡')
      await refreshExams()
    } catch (error) {
      message.error('添加失败：' + errorMessage(error))
    } finally {
      setAddingExam(null)
    }
  }

  const handleRemoveExam = async (examId: string) => {
    if (!activeLevel) return
    try {
      await api.removeLevelExam(activeLevel.id, examId)
      message.success('已移除')
      await refreshExams()
    } catch (error) {
      message.error('移除失败：' + errorMessage(error))
    }
  }

  const columns: TableProps<Level>['columns'] = [
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      render: (v: number) => <Tag>{v}</Tag>,
    },
    {
      title: '关卡名称',
      dataIndex: 'name',
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    { title: '语种', dataIndex: 'lang', width: 80, render: (v: string) => langLabel(v) },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (v: string) => v || <Typography.Text type="secondary">—</Typography.Text>,
    },
    { title: '创建时间', dataIndex: 'created_at', width: 170, render: (v: string) => formatTime(v) },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, record: Level) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<SettingOutlined />} onClick={() => openExamDrawer(record)}>
            题目
          </Button>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该关卡？" onConfirm={() => handleDelete(record)} okText="删除" cancelText="取消">
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
          关卡配置
        </Typography.Title>
      </div>

      <Card
        title="关卡列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => setRefreshTick((t) => t + 1)}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建关卡
            </Button>
          </Space>
        }
      >
        <Table<Level>
          rowKey="id"
          columns={columns}
          dataSource={levels}
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无关卡，点击「新建关卡」开始创建' }}
        />
      </Card>

      {/* 新建/编辑 Modal */}
      <Modal
        title={editing ? '编辑关卡' : '新建关卡'}
        open={formOpen}
        onOk={handleSubmit}
        onCancel={() => setFormOpen(false)}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="关卡名称"
            name="name"
            rules={[{ required: true, message: '请输入关卡名称' }]}
          >
            <Input placeholder="如：A1 听力入门" />
          </Form.Item>
          {!editing && (
            <Form.Item label="语种" name="lang" rules={[{ required: true, message: '请选择语种' }]}>
              <Select options={LANGS} />
            </Form.Item>
          )}
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="关卡说明（可选）" />
          </Form.Item>
          <Form.Item label="排序" name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 管理 exam Drawer */}
      <Drawer
        title={activeLevel ? `关卡题目 · ${activeLevel.name}` : '关卡题目'}
        open={examDrawerOpen}
        onClose={() => setExamDrawerOpen(false)}
        width={720}
      >
        {activeLevel ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" title="已关联的听力 Exam">
              {loadingExams ? (
                <Typography.Text type="secondary">加载中…</Typography.Text>
              ) : linkedExams.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未关联任何 exam" />
              ) : (
                <Table<LevelExam>
                  size="small"
                  rowKey="exam_id"
                  pagination={false}
                  dataSource={linkedExams}
                  columns={[
                    { title: '顺序', dataIndex: 'sort_order', width: 70 },
                    {
                      title: 'Exam ID',
                      dataIndex: 'exam_id',
                      render: (v: string) => <Typography.Text copyable>{v}</Typography.Text>,
                    },
                    { title: '语种', dataIndex: 'lang', width: 70, render: (v: string) => langLabel(v) },
                    {
                      title: '操作',
                      width: 80,
                      render: (_: unknown, record: LevelExam) => (
                        <Button
                          size="small"
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveExam(record.exam_id)}
                        >
                          移除
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </Card>

            <Card size="small" title="可添加的听力 Exam（已构建完成）">
              {loadingExams ? (
                <Typography.Text type="secondary">加载中…</Typography.Text>
              ) : availableExams.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有可添加的 exam" />
              ) : (
                <Table<AvailableExam>
                  size="small"
                  rowKey="exam_id"
                  pagination={{ pageSize: 10 }}
                  dataSource={availableExams}
                  columns={[
                    {
                      title: 'Exam ID',
                      dataIndex: 'exam_id',
                      render: (v: string) => <Typography.Text copyable>{v}</Typography.Text>,
                    },
                    { title: '语种', dataIndex: 'lang', width: 70, render: (v: string) => langLabel(v) },
                    {
                      title: '来源',
                      dataIndex: 'source_url',
                      ellipsis: true,
                      render: (v: string) => (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {v}
                        </Typography.Text>
                      ),
                    },
                    {
                      title: '操作',
                      width: 80,
                      render: (_: unknown, record: AvailableExam) => (
                        <Button
                          size="small"
                          type="link"
                          icon={<PlusOutlined />}
                          loading={addingExam === record.exam_id}
                          onClick={() => handleAddExam(record.exam_id)}
                        >
                          添加
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </div>
  )
}
