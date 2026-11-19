import { Button, Result, Spin } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { consumeSsoState, exchangeSsoCode } from '../auth'

/** SSO 回调页：校验 state 并用 code 换 token。 */
export default function SsoCallbackPage() {
  const [error, setError] = useState('')
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code') ?? ''
    const state = params.get('state') ?? ''
    const expected = consumeSsoState()

    if (!code) {
      setError('回调缺少授权码，请重新登录。')
      return
    }
    if (expected && state !== expected) {
      setError('登录状态校验失败，请重新登录。')
      return
    }

    const redirectUri = `${window.location.origin}/sso/callback`
    exchangeSsoCode(code, redirectUri)
      .then(() => {
        window.location.replace('/')
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  if (!error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" tip="正在登录…">
          <div style={{ width: 200, height: 80 }} />
        </Spin>
      </div>
    )
  }

  return (
    <Result
      status="error"
      title="SSO 登录失败"
      subTitle={error}
      extra={
        <Button type="primary" onClick={() => window.location.replace('/')}>
          返回登录
        </Button>
      }
    />
  )
}
