import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage, formatTime, isDownloadable } from '../api'
import { LANGS, langLabel, type Health, type Lang, type RepoStatus, type VersionInfo } from '../types'

type VersionMap = Partial<Record<Lang, VersionInfo | null>>

export default function DashboardPage() {
  const [health, setHealth] = useState<Health | null>(null)
  const [healthError, setHealthError] = useState('')
  const [versions, setVersions] = useState<VersionMap>({})
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [repos, setRepos] = useState<RepoStatus[]>([])
  const [loadingRepos, setLoadingRepos] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await api.health()
        if (!cancelled) {
          setHealth(data)
          setHealthError('')
        }
      } catch (error) {
        if (!cancelled) setHealthError(errorMessage(error))
      }
    }
    void load()
    const timer = window.setInterval(load, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const loadVersions = async () => {
    setLoadingVersions(true)
    setLoadingRepos(true)
    const next: VersionMap = {}
    await Promise.all(
      LANGS.map(async ({ value }) => {
        try {
          next[value] = await api.version(value)
        } catch {
          next[value] = null
        }
      }),
    )
    setVersions(next)
    setLoadingVersions(false)

    try {
      const data = await api.repos()
      setRepos(data.repos)
    } catch {
      setRepos([])
    }
    setLoadingRepos(false)
  }

  useEffect(() => {
    void loadVersions()
  }, [])

  return (
    <div>
      <div className="page-head">
        <Typography.Title level={4} style={{ margin: 0 }}>
          概览
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadVersions} loading={loadingVersions}>
            刷新版本
          </Button>
          <Link to="/builds">
            <Button type="primary">去构建</Button>
          </Link>
        </Space>
      </div>

      {healthError ? (
        <Alert
          type="error"
          showIcon
          message="无法连接版本服务"
          description={healthError}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card loading={!health && !healthError}>
            <Statistic
              title="可用内存"
              value={health?.available_mb ?? 0}
              suffix="MB"
              valueStyle={{ color: (health?.available_mb ?? 0) < 120 ? '#cf1322' : undefined }}
            />
            <Typography.Text type="secondary">低于 120MB 时构建会被拒绝</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={!health && !healthError}>
            <Typography.Text type="secondary">PostgreSQL</Typography.Text>
            <div className="stat-line">
              <Tag color={health?.postgres === 'ok' ? 'success' : 'error'}>
                {health?.postgres === 'ok' ? '连接正常' : health?.postgres || '未知'}
              </Tag>
            </div>
            <Typography.Text type="secondary">构建期向量与版本记录</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card loading={!health && !healthError}>
            <Typography.Text type="secondary">构建任务</Typography.Text>
            <div className="stat-line">
              <Tag color={health?.build_busy ? 'processing' : 'default'}>
                {health?.build_busy ? '构建中' : '空闲'}
              </Tag>
            </div>
            <Typography.Text type="secondary">同一时刻只允许一个构建</Typography.Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="素材仓库" loading={loadingRepos}>
            {repos.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未配置素材仓库（设置 REPO_<LANG>_URL 环境变量）" />
            ) : (
              <Row gutter={[16, 16]}>
                {repos.map((repo) => (
                  <Col xs={24} md={12} lg={8} key={repo.lang}>
                    <Card
                      size="small"
                      title={
                        <Space>
                          <span>{langLabel(repo.lang)}</span>
                          {repo.pending ? (
                            <Tag color="warning">有待构建变更</Tag>
                          ) : repo.last_build_version ? (
                            <Tag color="success">已是最新</Tag>
                          ) : (
                            <Tag color="default">未构建</Tag>
                          )}
                        </Space>
                      }
                    >
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        <div>
                          <Typography.Text type="secondary">最新 commit：</Typography.Text>
                          {repo.error ? (
                            <Tag color="error">查询失败</Tag>
                          ) : (
                            <Typography.Text copyable>
                              {repo.latest_commit_short || '—'}
                            </Typography.Text>
                          )}
                        </div>
                        <div>
                          <Typography.Text type="secondary">最近构建：</Typography.Text>
                          {repo.last_build_version ? (
                            <Typography.Text>{repo.last_build_version}</Typography.Text>
                          ) : (
                            <Typography.Text type="secondary">无</Typography.Text>
                          )}
                        </div>
                        {repo.last_build_at ? (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {formatTime(repo.last_build_at)}
                          </Typography.Text>
                        ) : null}
                        {repo.pending && (
                          <Link to="/builds">
                            <Button size="small" type="primary">
                              去构建
                            </Button>
                          </Link>
                        )}
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {LANGS.map(({ value, label }) => {
          const info = versions[value]
          return (
            <Col xs={24} lg={8} key={value}>
              <Card title={`${label} · 最新版本`} loading={loadingVersions}>
                {info ? (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text strong copyable>
                      {info.version}
                    </Typography.Text>
                    <Typography.Text type="secondary">{formatTime(info.created_at)}</Typography.Text>
                    <Space wrap>
                      <Button
                        size="small"
                        type="primary"
                        icon={<DownloadOutlined />}
                        href={info.ground_truth.url}
                        target="_blank"
                        rel="noreferrer"
                        disabled={!isDownloadable(info.ground_truth.url)}
                      >
                        真值库
                      </Button>
                      <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        href={info.vector_snapshot.url}
                        target="_blank"
                        rel="noreferrer"
                        disabled={!isDownloadable(info.vector_snapshot.url)}
                      >
                        向量快照
                      </Button>
                    </Space>
                  </Space>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`${langLabel(value)}暂无已构建版本`} />
                )}
              </Card>
            </Col>
          )
        })}
      </Row>
    </div>
  )
}
