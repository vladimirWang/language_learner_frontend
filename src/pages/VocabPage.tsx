import {
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  type TableProps,
} from 'antd'
import { useEffect, useState } from 'react'
import { ApiError, api, errorMessage, formatTime } from '../api'
import { LANGS, langLabel, type VocabWord } from '../types'

const WORD_TYPE_OPTIONS = [
  { value: 'noun', label: '名词' },
  { value: 'verb', label: '动词' },
  { value: 'adj', label: '形容词' },
  { value: 'adv', label: '副词' },
  { value: 'prep', label: '介词' },
  { value: 'particle', label: '小品词' },
]

const WORD_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WORD_TYPE_OPTIONS.map((item) => [item.value, item.label]),
)

const GENDER_OPTIONS = [
  { value: 'm', label: '阳性 m' },
  { value: 'f', label: '阴性 f' },
  { value: 'n', label: '中性 n' },
]

const GENDER_LABELS: Record<string, string> = Object.fromEntries(
  GENDER_OPTIONS.map((item) => [item.value, item.label]),
)

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'N5', 'N4', 'N3', 'N2', 'N1'].map(
  (level) => ({ value: level, label: level }),
)

interface VocabFormValues {
  lang: string
  lemma: string
  level: string
  word_type: string
  gender?: string
  plural?: string
  chinese_mean: string
  english_mean?: string
  example_de?: string
  source_md_path?: string
}

type VocabPayload = Omit<VocabWord, 'word_id' | 'updated_at'>

function toPayload(values: VocabFormValues): VocabPayload {
  return {
    lang: values.lang,
    lemma: values.lemma.trim(),
    level: values.level,
    word_type: values.word_type,
    gender: values.gender ?? '',
    plural: values.plural?.trim() ?? '',
    chinese_mean: values.chinese_mean.trim(),
    english_mean: values.english_mean?.trim() ?? '',
    example_de: values.example_de?.trim() ?? '',
    source_md_path: values.source_md_path?.trim() ?? '',
  }
}

export default function VocabPage() {
  const { message } = AntApp.useApp()

  const [lang, setLang] = useState('de')
  const [level, setLevel] = useState('')
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [items, setItems] = useState<VocabWord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<VocabWord | null>(null)
  const [form] = Form.useForm<VocabFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const wordType = Form.useWatch('word_type', form)

  const [importOpen, setImportOpen] = useState(false)
  const [importLang, setImportLang] = useState('de')
  const [importName, setImportName] = useState('')
  const [importCSV, setImportCSV] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .listVocabWords({
        lang,
        level: level || undefined,
        q: appliedQuery || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      .then((res) => {
        if (cancelled) return
        setItems(res.words ?? [])
        setTotal(res.total ?? 0)
      })
      .catch((error) => {
        if (cancelled) return
        message.error('加载新词库失败：' + errorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [lang, level, appliedQuery, page, refreshTick])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      lang,
      level: level || 'A1',
      word_type: 'noun',
    })
    setFormOpen(true)
  }

  const openEdit = (item: VocabWord) => {
    setEditing(item)
    form.resetFields()
    form.setFieldsValue({
      lang: item.lang,
      lemma: item.lemma,
      level: item.level,
      word_type: item.word_type ?? 'noun',
      gender: item.gender,
      plural: item.plural,
      chinese_mean: item.chinese_mean,
      english_mean: item.english_mean,
      example_de: item.example_de,
      source_md_path: item.source_md_path,
    })
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (values.word_type !== 'noun') values.gender = ''
      setSubmitting(true)
      const payload = toPayload(values)
      if (editing) {
        await api.updateVocabWord(editing.word_id, payload)
        message.success('词条已更新')
      } else {
        await api.createVocabWord(payload)
        message.success('词条已创建')
      }
      setFormOpen(false)
      setRefreshTick((t) => t + 1)
    } catch (error) {
      if (error instanceof ApiError) {
        message.error(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (item: VocabWord) => {
    try {
      await api.deleteVocabWord(item.word_id)
      message.success('已删除')
      if (items.length === 1 && page > 1) setPage(page - 1)
      else setRefreshTick((t) => t + 1)
    } catch (error) {
      message.error('删除失败：' + errorMessage(error))
    }
  }

  const openImport = () => {
    setImportLang(lang)
    setImportName('')
    setImportCSV('')
    setImportResult(null)
    setImportErrors([])
    setImportOpen(true)
  }

  const handleImport = async (dryRun: boolean) => {
    if (!importCSV) {
      message.warning('请先选择 CSV 文件')
      return
    }
    setImporting(true)
    setImportErrors([])
    setImportResult(null)
    try {
      const res = await api.importVocabWords({ lang: importLang, csv: importCSV, dry_run: dryRun })
      if (res.dry_run) {
        setImportResult(`校验通过：共 ${res.total} 条词条，未写入数据库。`)
      } else {
        setImportResult(`导入完成：新增 ${res.inserted} 条，更新 ${res.updated} 条。`)
        setRefreshTick((t) => t + 1)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setImportResult(error.message)
        setImportErrors(error.details ?? [])
      } else {
        setImportResult(errorMessage(error))
      }
    } finally {
      setImporting(false)
    }
  }

  const columns: TableProps<VocabWord>['columns'] = [
    {
      title: '词条',
      dataIndex: 'lemma',
      width: 140,
      render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
    },
    {
      title: '词性',
      dataIndex: 'word_type',
      width: 90,
      render: (value?: string) =>
        value ? <Tag color="blue">{WORD_TYPE_LABELS[value] ?? value}</Tag> : <Tag>—</Tag>,
    },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 90,
      render: (value?: string) =>
        value ? <Tag color="purple">{GENDER_LABELS[value] ?? value}</Tag> : <Tag>—</Tag>,
    },
    {
      title: '复数',
      dataIndex: 'plural',
      width: 110,
      render: (value?: string) => value || '—',
    },
    {
      title: '等级',
      dataIndex: 'level',
      width: 70,
      render: (value: string) => <Tag color="green">{value}</Tag>,
    },
    { title: '中文释义', dataIndex: 'chinese_mean', width: 160 },
    {
      title: '英文释义',
      dataIndex: 'english_mean',
      width: 140,
      render: (value?: string) => value || '—',
    },
    {
      title: '例句',
      dataIndex: 'example_de',
      ellipsis: true,
      render: (value?: string) => value || '—',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 150,
      render: (value: string) => formatTime(value),
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
            title="确定删除该词条？"
            description="该词的学习记录会一并删除。"
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

  const nounOnly = wordType === 'noun' || !wordType

  return (
    <Card
      title="新词库"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshTick((t) => t + 1)}>
            刷新
          </Button>
          <Button onClick={openImport}>导入 CSV</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增词条
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        词条直接写入 <Typography.Text code>vocab_words</Typography.Text>，供每日新词接口读取。
        管理台新增的词不会写回 <Typography.Text code>content/&lt;lang&gt;/vocab.csv</Typography.Text>
        ：重建索引不会删除这些词，但客户端真值库快照仍以 CSV 为准，需要长期保留时请同步回 CSV。
      </Typography.Paragraph>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          value={lang}
          style={{ width: 110 }}
          options={LANGS.map((item) => ({ value: item.value, label: item.label }))}
          onChange={(value) => {
            setLang(value)
            setPage(1)
          }}
        />
        <Select
          value={level}
          style={{ width: 110 }}
          options={[{ value: '', label: '全部等级' }, ...LEVEL_OPTIONS]}
          onChange={(value) => {
            setLevel(value)
            setPage(1)
          }}
        />
        <Input
          allowClear
          style={{ width: 260 }}
          placeholder="搜索词条 / 中文 / 英文释义"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={() => {
            setAppliedQuery(query.trim())
            setPage(1)
          }}
        />
        <Button
          icon={<SearchOutlined />}
          onClick={() => {
            setAppliedQuery(query.trim())
            setPage(1)
          }}
        >
          搜索
        </Button>
      </Space>

      <Table
        rowKey="word_id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          showTotal: (value) => `共 ${value} 条`,
          onChange: (value) => setPage(value),
        }}
      />

      <Modal
        title={editing ? '编辑词条' : '新增词条'}
        open={formOpen}
        onOk={handleSubmit}
        confirmLoading={submitting}
        onCancel={() => setFormOpen(false)}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="lang" label="语种" rules={[{ required: true }]} style={{ width: 140 }}>
              <Select
                disabled={!!editing}
                options={LANGS.map((item) => ({ value: item.value, label: item.label }))}
              />
            </Form.Item>
            <Form.Item
              name="lemma"
              label="词条"
              rules={[{ required: true, message: '请输入词条' }]}
              style={{ flex: 1, minWidth: 220 }}
            >
              <Input placeholder="z. B. Hund" maxLength={80} />
            </Form.Item>
            <Form.Item name="level" label="等级" rules={[{ required: true }]} style={{ width: 100 }}>
              <Select options={LEVEL_OPTIONS} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item
              name="word_type"
              label="词性"
              rules={[{ required: true, message: '请选择词性' }]}
              style={{ width: 140 }}
            >
              <Select options={WORD_TYPE_OPTIONS} />
            </Form.Item>
            <Form.Item
              name="gender"
              label="词性性别"
              rules={[{ required: nounOnly && !!wordType, message: '德语名词必须填写词性' }]}
              style={{ width: 140 }}
            >
              <Select
                allowClear
                disabled={!nounOnly}
                options={GENDER_OPTIONS}
                placeholder={nounOnly ? 'm / f / n' : '仅名词填写'}
              />
            </Form.Item>
            <Form.Item name="plural" label="复数" style={{ flex: 1, minWidth: 180 }}>
              <Input placeholder="z. B. Hunde" maxLength={80} />
            </Form.Item>
          </Space>
          <Form.Item
            name="chinese_mean"
            label="中文释义"
            rules={[{ required: true, message: '请输入中文释义' }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="english_mean" label="英文释义">
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="example_de" label="德语例句">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item
            name="source_md_path"
            label="来源文档"
            extra="可选，例如 de/vocab/Hund.md；用于 builder 提取例句。"
          >
            <Input maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入 CSV"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setImportOpen(false)}>关闭</Button>
            <Button loading={importing} onClick={() => void handleImport(true)}>
              仅校验
            </Button>
            <Button type="primary" loading={importing} onClick={() => void handleImport(false)}>
              开始导入
            </Button>
          </Space>
        }
        width={620}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space>
            <span>语种</span>
            <Select
              value={importLang}
              style={{ width: 120 }}
              options={LANGS.map((item) => ({ value: item.value, label: item.label }))}
              onChange={setImportLang}
            />
          </Space>
          <Upload.Dragger
            accept=".csv,text/csv"
            maxCount={1}
            beforeUpload={(file) => {
              setImportName(file.name)
              setImportResult(null)
              setImportErrors([])
              void file.text().then(setImportCSV)
              return false
            }}
            onRemove={() => {
              setImportName('')
              setImportCSV('')
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽 CSV 文件到此处</p>
            <p className="ant-upload-hint">
              表头需包含 lemma、level、chinese_mean；可包含 lang、word_type、gender、plural、
              english_mean、example_de、source_md_path，其余列忽略。
            </p>
          </Upload.Dragger>
          {importName && (
            <Typography.Text type="secondary">
              已选择：{importName}（{langLabel(importLang)}）
            </Typography.Text>
          )}
          {importResult && (
            <Alert
              type={importErrors.length > 0 ? 'error' : 'success'}
              showIcon
              message={importResult}
              description={
                importErrors.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {importErrors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : undefined
              }
            />
          )}
        </Space>
      </Modal>
    </Card>
  )
}
