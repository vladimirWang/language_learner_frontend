import { Alert, App as AntApp, Button, Card, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { fetchSsoConfig, startSsoLogin, type SsoConfig } from '../auth'

/** 未登录时展示的 SSO 入口。 */
export default function LoginPage() {
  const { message } = AntApp.useApp()
  const [config, setConfig] = useState<SsoConfig | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSsoConfig()
      .then((value) => setConfig(value))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = () => {
    if (!config) return
    if (!config.enabled) {
      message.error('服务端尚未配置 SSO 登录')
      return
    }
    startSsoLogin(config)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}
    >
      <Card style={{ width: 420 }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              素材管理台
            </Typography.Title>
            <Typography.Text type="secondary">使用统一账号（SSO）登录后继续操作</Typography.Text>
          </div>
          {error && <Alert type="error" showIcon message="无法获取登录配置" description={error} />}
          {config && !config.enabled && (
            <Alert
              type="warning"
              showIcon
              message="SSO 未配置"
              description="请在服务端配置 SSO_BASE_URL、SSO_CLIENT_ID、SSO_CLIENT_SECRET 与 SSO_REDIRECT_URI。"
            />
          )}
          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            disabled={!config?.enabled}
            onClick={handleLogin}
          >
            使用 SSO 登录
          </Button>
        </Space>
      </Card>
    </div>
  )
}
