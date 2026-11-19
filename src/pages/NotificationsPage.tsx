import { App as AntApp, Button, Card, Empty, Tag, Timeline, Typography } from 'antd'
import { BellOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage } from '../api'
import type { NotificationsResponse, SystemNotification } from '../types'

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function eventTypeTag(evt: SystemNotification) {
  const color = evt.read_at ? 'default' : evt.event_type === 'error' ? 'red' : evt.event_type === 'success' ? 'green' : evt.event_type === 'info' ? 'blue' : 'orange'
  const label = evt.event_type === 'success' ? '成功' : evt.event_type === 'error' ? '失败' : evt.event_type === 'progress' ? '进行中' : '信息'
  return <Tag color={color}>{label}</Tag>
}

export default function NotificationsPage() {
  const { message } = AntApp.useApp()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NotificationsResponse | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.listNotifications(100)
      setData(res)
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const markAll = async () => {
    try {
      await api.markNotificationRead({ all: true })
      message.success('已全部标为已读')
      await load()
    } catch (error) {
      message.error(errorMessage(error))
    }
  }

  const openJob = (n: SystemNotification) => {
    if (n.job_id.startsWith('job-')) {
      navigate(`/listening/jobs`)
    }
  }

  const now = new Date()
  const isRecent = (iso?: string | null) => {
    if (!iso) return false
    const d = new Date(iso)
    return (now.getTime() - d.getTime()) < 24 * 60 * 60 * 1000
  }

  const grouped = data?.notifications.reduce<Record<string, SystemNotification[]>>((acc, n) => {
    const key = isRecent(n.created_at) ? '今日' : n.created_at.slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(n)
    return acc
  }, {}) ?? {}

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <BellOutlined style={{ marginRight: 8 }} />
          系统消息
          {data && data.unread_count > 0 && (
            <Tag color="red" style={{ marginLeft: 8 }}>{data.unread_count} 未读</Tag>
          )}
        </Typography.Title>
        <div>
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load} style={{ marginRight: 8 }}>
            刷新
          </Button>
          <Button size="small" icon={<CheckOutlined />} disabled={!data || data.unread_count === 0} onClick={markAll}>
            全部已读
          </Button>
        </div>
      </div>

      <Card loading={loading}>
        {(!data || data.notifications.length === 0) ? (
          <Empty description="暂无系统消息" />
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} style={{ marginBottom: 24 }}>
              <Typography.Text type="secondary" style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
                {date}
              </Typography.Text>
              <Timeline
                items={items.map((n) => ({
                  color: n.read_at ? 'gray' : n.event_type === 'error' ? 'red' : n.event_type === 'success' ? 'green' : 'blue',
                  children: (
                    <div style={{ padding: '4px 0', opacity: n.read_at ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {eventTypeTag(n)}
                        <Typography.Text strong>{n.title}</Typography.Text>
                        {!n.read_at && <Tag color="blue">未读</Tag>}
                      </div>
                      {n.message && (
                        <div style={{ marginTop: 4, color: '#555', fontSize: 13 }}>{n.message}</div>
                      )}
                      {n.payload && typeof (n.payload as Record<string, unknown>).exam_id === 'string' && (
                        <Button size="small" type="link" style={{ padding: '0 4px', marginTop: 4 }} onClick={() => openJob(n)}>
                          查看任务 →
                        </Button>
                      )}
                      <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>{formatTime(n.created_at)}</div>
                    </div>
                  ),
                }))}
              />
            </div>
          ))
        )}
      </Card>
    </div>
  )
}
