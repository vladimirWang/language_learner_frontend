import { PlayCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  List,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  type TableProps,
} from 'antd'
import { useEffect, useState } from 'react'
import { api, errorMessage, formatTime } from '../api'
import { LANGS, langLabel, type BuildLog, type BuildStatus, type Lang, type RecentBuild } from '../types'

const RECENT_KEY = 'lang-admin.recent-builds'

function loadRecent(): RecentBuild[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as RecentBuild[]) : []
  } catch {
    return []
  }
}

function saveRecent(items: RecentBuild[]) {
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(items))
}

function statusColor(status: string): string {
  if (status === 'built') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'building') return 'processing'
  return 'default'
}

function levelColor(level: string): string {
  if (level === 'error') return 'red'
  if (level === 'warn' || level === 'warning') return 'orange'
  return 'blue'
}

const logColumns: TableProps<BuildLog>['columns'] = [
  {
    title: '时间',
    dataIndex: 'created_at',
    width: 170,
    render: (value: string) => formatTime(value),
  },
  {
    title: '阶段',
    dataIndex: 'stage',
    width: 110,
    render: (value: string) => <Tag>{value}</Tag>,
  },
  {
    title: '级别',
    dataIndex: 'level',
    width: 90,
    render: (value: string) => <Tag color={levelColor(value)}>{value}</Tag>,
  },
  {
    title: '日志',
    dataIndex: 'message',
    render: (value: string) => <span style={{ wordBreak: 'break-all' }}>{value}</span>,
  },
]

export default function BuildsPage() {
  const { message } = AntApp.useApp()
  const [form] = Form.useForm<{ lang: Lang; version?: string }>()
  const [recent, setRecent] = useState<RecentBuild[]>(loadRecent)
  const [triggering, setTriggering] = useState(false)
  const [currentVersion, setCurrentVersion] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [status, setStatus] = useState<BuildStatus | null>(null)
  const [statusError, setStatusError] = useState('')
  const [loadingStatus, setLoadingStatus] = useState(false)

  const queryVersion = (version: string) => {
    const trimmed = version.trim()
    if (!trimmed) {
      message.warning('请输入版本号')
      return
    }
    setCurrentVersion(trimmed)
    setStatus(null)
    setStatusError('')
    setRefreshToken((token) => token + 1)
  }

  useEffect(() => {
    if (!currentVersion) return
    let cancelled = false
    let timer: number | undefined

    const tick = async () => {
      setLoadingStatus(true)
      try {
        const data = await api.buildStatus(currentVersion)
        if (cancelled) return
        setStatus(data)
        setStatusError('')
        if (data.status === 'building') {
          timer = window.setTimeout(tick, 3000)
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(null)
          setStatusError(errorMessage(error))
        }
      } finally {
        if (!cancelled) setLoadingStatus(false)
      }
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [currentVersion, refreshToken])

  const onTrigger = async (values: { lang: Lang; version?: string }) => {
    setTriggering(true)
    try {
      const result = await api.triggerBuild({
        lang: values.lang,
        version: values.version?.trim() || undefined,
      })
      message.success(`构建已启动：${result.version}`)
      const entry: RecentBuild = {
        version: result.version,
        lang: result.lang,
        createdAt: new Date().toISOString(),
      }
      const next = [entry, ...recent.filter((item) => item.version !== entry.version)].slice(0, 10)
      setRecent(next)
      saveRecent(next)
      queryVersion(result.version)
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <Typography.Title level={4} style={{ margin: 0 }}>
          构建任务
        </Typography.Title>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={9}>
          <Card title="触发构建">
            <Form form={form} layout="vertical" initialValues={{ lang: 'de' }} onFinish={onTrigger}>
              <Form.Item name="lang" label="语种" rules={[{ required: true }]}>
                <Select options={LANGS} />
              </Form.Item>
              <Form.Item
                name="version"
                label="版本号"
                extra="留空由服务端按时间生成；手动指定时建议使用可排序的格式"
              >
                <Input placeholder="例如 20261116-120000" allowClear />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={triggering} icon={<PlayCircleOutlined />}>
                启动构建
              </Button>
            </Form>
          </Card>

          <Card title="最近构建" style={{ marginTop: 16 }}>
            {recent.length ? (
              <List
                size="small"
                dataSource={recent}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key="view" size="small" type="link" onClick={() => queryVersion(item.version)}>
                        查看
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={item.version}
                      description={`${langLabel(item.lang)} · ${formatTime(item.createdAt)}`}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Typography.Text type="secondary">暂无本机触发记录</Typography.Text>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={15}>
          <Card
            title="构建状态"
            extra={
              <Space>
                <Input
                  placeholder="输入版本号查询"
                  value={currentVersion}
                  onChange={(event) => setCurrentVersion(event.target.value)}
                  onPressEnter={() => queryVersion(currentVersion)}
                  allowClear
                  style={{ width: 220 }}
                />
                <Button icon={<SearchOutlined />} onClick={() => queryVersion(currentVersion)}>
                  查询
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  disabled={!currentVersion}
                  loading={loadingStatus}
                  onClick={() => setRefreshToken((token) => token + 1)}
                >
                  刷新
                </Button>
              </Space>
            }
          >
            {statusError ? (
              <Alert type="error" showIcon message="查询失败" description={statusError} />
            ) : null}

            {!currentVersion ? (
              <Typography.Text type="secondary">启动构建后会自动跟踪状态，也可以输入版本号查询。</Typography.Text>
            ) : null}

            {status ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: 'version',
                      label: '版本号',
                      children: <Typography.Text copyable>{status.version}</Typography.Text>,
                    },
                    {
                      key: 'lang',
                      label: '语种',
                      children: langLabel(status.lang),
                    },
                    {
                      key: 'status',
                      label: '状态',
                      children: <Tag color={statusColor(status.status)}>{status.status}</Tag>,
                    },
                    {
                      key: 'created_at',
                      label: '创建时间',
                      children: formatTime(status.created_at),
                    },
                    {
                      key: 'db',
                      label: '真值库',
                      children: (
                        <Space direction="vertical" size={2}>
                          <Typography.Text copyable>{status.db_url || '—'}</Typography.Text>
                          <Typography.Text type="secondary">md5: {status.db_md5 || '—'}</Typography.Text>
                        </Space>
                      ),
                    },
                    {
                      key: 'vector',
                      label: '向量快照',
                      children: (
                        <Space direction="vertical" size={2}>
                          <Typography.Text copyable>{status.vector_snapshot_url || '—'}</Typography.Text>
                          <Typography.Text type="secondary">md5: {status.vector_md5 || '—'}</Typography.Text>
                        </Space>
                      ),
                    },
                  ]}
                />

                <Table<BuildLog>
                  size="small"
                  rowKey={(record) => `${record.created_at}-${record.stage}-${record.message}`}
                  columns={logColumns}
                  dataSource={status.logs}
                  pagination={false}
                  scroll={{ y: 360 }}
                  loading={loadingStatus && !status.logs.length}
                />
              </Space>
            ) : null}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
