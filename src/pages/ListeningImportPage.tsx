import { AudioOutlined, BulbOutlined, PlayCircleOutlined, UploadOutlined } from '@ant-design/icons'
import { App as AntApp, Button, Card, Col, Form, Input, InputNumber, Row, Select, Space, Tag, Typography, Upload } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import { LANGS, type Lang } from '../types'

interface ImportFormValues {
  url: string
  examId: string
  lang: Lang
  model: string
}

interface GenerateFormValues {
  lang: Lang
  level: string
  topic?: string
  question_count: number
  device_id?: string
}

interface SSEEvent {
  type: string
  job_id: string
  stage?: string
  level?: string
  message?: string
  data?: Record<string, unknown>
}

const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'N5', 'N4', 'N3', 'N2', 'N1'].map((value) => ({
  value,
  label: value,
}))

const API_BASE = '' // 走 vite proxy，空字符串即同源

export default function ListeningImportPage() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<ImportFormValues>()
  const [generateForm] = Form.useForm<GenerateFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [answersFile, setAnswersFile] = useState<File | null>(null)
  const [cookiesFile, setCookiesFile] = useState<File | null>(null)
  const [genResult, setGenResult] = useState<{
    job_id: string
    exam_id: string
    title: string
    dialogue_lines: number
    question_count: number
    vocabulary_used: string[]
  } | null>(null)

  const onSubmit = async (values: ImportFormValues) => {
    if (!values.url.trim()) {
      message.warning('请输入音视频 URL')
      return
    }
    if (!values.examId.trim()) {
      message.warning('请输入 examId')
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('url', values.url.trim())
      formData.append('examId', values.examId.trim())
      formData.append('lang', values.lang)
      formData.append('model', values.model)
      if (answersFile) formData.append('answers', answersFile)
      if (cookiesFile) formData.append('cookies', cookiesFile)
      const result = await api.importListening(formData)
      message.success(`任务已启动：${result.job_id}`)
      form.resetFields()
      setAnswersFile(null)
      setCookiesFile(null)
      navigate('/listening/jobs')
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const onGenerate = async (values: GenerateFormValues) => {
    if (!values.level) {
      message.warning('请选择难度')
      return
    }
    try {
      const res = await api.generateListening({
        lang: values.lang,
        level: values.level,
        topic: values.topic?.trim() || undefined,
        question_count: values.question_count,
        device_id: values.device_id?.trim() || undefined,
      })
      // 立即放开按钮——HTTP 202 只代表"任务已入队"
      setGenResult(null)
      message.success('任务已提交，生成完成后会自动展示结果')

      // 只订阅最终 success / error，不跟踪中间进度
      const es = new EventSource(`${API_BASE}${res.sse_endpoint}`)
      es.addEventListener('success', (ev) => {
        const evt = (ev as MessageEvent).data ? (JSON.parse((ev as MessageEvent).data) as SSEEvent) : null
        if (evt) {
          const d = (evt.data as Record<string, unknown>) || {}
          setGenResult({
            job_id: evt.job_id,
            exam_id: (d.exam_id as string) || '',
            title: (d.title as string) || evt.message || '生成完成',
            dialogue_lines: (d.dialogue_lines as number) || 0,
            question_count: (d.question_count as number) || 0,
            vocabulary_used: (d.vocabulary_used as string[]) || [],
          })
          message.success('AI 听力生成完成！')
        }
        es.close()
      })
      es.addEventListener('error', (ev) => {
        const evt = (ev as MessageEvent).data ? (JSON.parse((ev as MessageEvent).data) as SSEEvent) : null
        if (evt) {
          message.error(`生成失败：${evt.message}`)
        }
        es.close()
      })
      // 兜底：超时关闭，避免长时间悬挂
      setTimeout(() => {
        if (es.readyState !== EventSource.CLOSED) es.close()
      }, 300000)
    } catch (error) {
      message.error(errorMessage(error))
    }
  }

  return (
    <div>
      <div className="page-head">
        <Typography.Title level={4} style={{ margin: 0 }}>
          听力导入
        </Typography.Title>
      </div>

      <Row gutter={[24, 24]} justify="center">
        {/* 从 URL 导入 */}
        <Col xs={24} md={16} lg={12}>
          <Card
            title={
              <Space>
                <AudioOutlined />
                <span>从音视频 URL 导入</span>
              </Space>
            }
          >
            <Form
              form={form}
              layout="vertical"
              initialValues={{ lang: 'de', model: 'small' }}
              onFinish={onSubmit}
            >
              <Form.Item
                name="url"
                label="音视频 URL"
                rules={[{ required: true, message: '请输入 URL' }]}
                extra="支持 B 站 / YouTube 等 yt-dlp 兼容的视频页面地址"
              >
                <Input
                  placeholder="https://www.bilibili.com/video/BV1FLMGzgEk2/?p=6"
                  allowClear
                />
              </Form.Item>

              <Form.Item
                name="examId"
                label="Exam ID"
                rules={[
                  { required: true, message: '请输入 examId' },
                  { pattern: /^[a-z0-9-]+$/, message: '仅允许小写字母、数字、短横线' },
                ]}
                extra="作为输出目录名，如 goethe-a1-hoeren-01"
              >
                <Input placeholder="goethe-a1-hoeren-01" allowClear />
              </Form.Item>

              <Form.Item name="lang" label="语种" rules={[{ required: true }]}>
                <Select options={LANGS} />
              </Form.Item>

              <Form.Item name="model" label="Whisper 模型">
                <Select
                  options={[
                    { value: 'tiny', label: 'tiny（最快，精度最低）' },
                    { value: 'base', label: 'base' },
                    { value: 'small', label: 'small（推荐，默认）' },
                    { value: 'medium', label: 'medium（精度更高，更慢）' },
                  ]}
                />
              </Form.Item>

              <Form.Item label="答案 CSV（可选）" extra="格式：题号,答案（如 1,B）">
                <Upload
                  beforeUpload={(file) => {
                    setAnswersFile(file)
                    return false
                  }}
                  onRemove={() => setAnswersFile(null)}
                  maxCount={1}
                  accept=".csv"
                  fileList={answersFile ? [{ uid: '-1', name: answersFile.name, status: 'done' }] : []}
                >
                  <Button icon={<UploadOutlined />}>选择答案 CSV</Button>
                </Upload>
              </Form.Item>

              <Form.Item label="B 站 Cookies（可选）" extra="浏览器导出的 cookies.txt（Netscape 格式）">
                <Upload
                  beforeUpload={(file) => {
                    setCookiesFile(file)
                    return false
                  }}
                  onRemove={() => setCookiesFile(null)}
                  maxCount={1}
                  accept=".txt"
                  fileList={cookiesFile ? [{ uid: '-2', name: cookiesFile.name, status: 'done' }] : []}
                >
                  <Button icon={<UploadOutlined />}>选择 cookies.txt</Button>
                </Upload>
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={submitting} icon={<PlayCircleOutlined />}>
                启动导入
              </Button>
            </Form>
          </Card>
        </Col>

        {/* AI 生成对话听力 */}
        <Col xs={24} md={16} lg={12}>
          <Card
            title={
              <Space>
                <BulbOutlined />
                <span>AI 生成对话听力</span>
              </Space>
            }
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                自动融入最近 5 天学过的词汇
              </Typography.Text>
            }
          >
            <Form
              form={generateForm}
              layout="vertical"
              initialValues={{ lang: 'de', level: 'A2', question_count: 3 }}
              onFinish={onGenerate}
            >
              <Form.Item name="lang" label="语种" rules={[{ required: true, message: '请选择语种' }]}>
                <Select options={LANGS} />
              </Form.Item>

              <Form.Item name="level" label="难度（CEFR / JLPT）" rules={[{ required: true, message: '请选择难度' }]}>
                <Select options={LEVEL_OPTIONS} placeholder="A1 / A2 / B1 ... / N1" />
              </Form.Item>

              <Form.Item
                name="topic"
                label="场景主题（可选）"
                extra="留空则让 AI 自由发挥日常场景（购物、问路、咖啡馆点单等）"
              >
                <Input placeholder="如：咖啡馆点单、在邮局寄包裹、周末计划" allowClear />
              </Form.Item>

              <Form.Item
                name="question_count"
                label="选择题数量"
                extra="会分散嵌入到对话各轮"
              >
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item
                name="device_id"
                label="Device ID（可选）"
                extra="用于查询该设备最近 5 天已学词汇，留空默认 admin"
              >
                <Input placeholder="admin" allowClear />
              </Form.Item>

              <Button type="primary" htmlType="submit" icon={<BulbOutlined />}>
                开始生成
              </Button>
            </Form>

            {genResult && (
              <div style={{ marginTop: 16, padding: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
                <Typography.Text strong>✅ 生成成功</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Typography.Text>
                    <strong>{genResult.title}</strong>（{genResult.exam_id}）
                  </Typography.Text>
                </div>
                <div style={{ marginTop: 4, color: '#666' }}>
                  {genResult.dialogue_lines} 轮对话 · {genResult.question_count} 道选择题
                </div>
                {genResult.vocabulary_used.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>融入的新词：</Typography.Text>
                    <div style={{ marginTop: 4 }}>
                      {genResult.vocabulary_used.map((v) => (
                        <Tag key={v} color="blue" style={{ marginBottom: 4 }}>{v}</Tag>
                      ))}
                    </div>
                  </div>
                )}
                <Space style={{ marginTop: 12 }}>
                  <Button size="small" onClick={() => navigate(`/listening/jobs`)}>
                    查看听力任务
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      generateForm.resetFields()
                      setGenResult(null)
                    }}
                  >
                    再来一篇
                  </Button>
                </Space>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
