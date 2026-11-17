import { AudioOutlined, PlayCircleOutlined, UploadOutlined } from '@ant-design/icons'
import { App as AntApp, Button, Card, Col, Form, Input, Row, Select, Space, Typography, Upload } from 'antd'
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

export default function ListeningImportPage() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm<ImportFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [answersFile, setAnswersFile] = useState<File | null>(null)
  const [cookiesFile, setCookiesFile] = useState<File | null>(null)

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

  return (
    <div>
      <div className="page-head">
        <Typography.Title level={4} style={{ margin: 0 }}>
          听力导入
        </Typography.Title>
      </div>

      <Row justify="center">
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
      </Row>
    </div>
  )
}
