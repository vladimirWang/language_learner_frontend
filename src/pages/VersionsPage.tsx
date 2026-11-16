import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Empty, Select, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import VersionDetail from '../components/VersionDetail'
import { LANGS, type Lang, type VersionInfo } from '../types'

export default function VersionsPage() {
  const [lang, setLang] = useState<Lang>('de')
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async (target: Lang) => {
    setLoading(true)
    setError('')
    try {
      setInfo(await api.version(target))
    } catch (err) {
      setInfo(null)
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(lang)
  }, [lang])

  return (
    <div>
      <div className="page-head">
        <Typography.Title level={4} style={{ margin: 0 }}>
          版本查询
        </Typography.Title>
        <Space>
          <Select
            value={lang}
            options={LANGS}
            onChange={(value: Lang) => setLang(value)}
            style={{ width: 140 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load(lang)} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Card>
        {error ? (
          <Alert type="warning" showIcon message="暂无可用版本" description={error} />
        ) : info ? (
          <VersionDetail info={info} />
        ) : (
          <Empty description={loading ? '加载中…' : '暂无已构建版本'} />
        )}
      </Card>

      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
        客户端通过版本号与 md5 比对决定是否下载；真值库与向量快照绑定同一版本，避免讲解与真值错配。
        未配置对象存储时这里显示的是构建机本地路径，仅供开发联调。
      </Typography.Paragraph>
    </div>
  )
}
