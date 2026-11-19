// 管理台 SSO 登录：授权码流程的浏览器侧状态管理与接口封装。
// client_secret 只保存在后端，前端只接触 code 与 access_token。

const TOKEN_KEY = 'admin.sso.token.v1'
const USER_KEY = 'admin.sso.user.v1'
const STATE_KEY = 'admin.sso.state.v1'

export interface AdminSsoUser {
  user_id: number
  email: string
  username: string
}

export interface SsoConfig {
  enabled: boolean
  authorize_url: string
  client_id: string
  redirect_uri: string
}

interface SsoExchangeResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: AdminSsoUser
}

export function getSsoToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function getSsoUser(): AdminSsoUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AdminSsoUser
  } catch {
    return null
  }
}

function saveSession(token: string, user: AdminSsoUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // 本地存储不可用时忽略
  }
}

export function clearSsoSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // ignore
  }
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error || `请求失败（HTTP ${response.status}）`
}

/** 读取后端公开配置，决定 SSO 是否可用以及授权地址。 */
export async function fetchSsoConfig(): Promise<SsoConfig> {
  const response = await fetch('/api/auth/sso/config', { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(await readError(response))
  return (await response.json()) as SsoConfig
}

/** 跳转 SSO 授权页；state 存 sessionStorage，回调时校验防 CSRF。 */
export function startSsoLogin(config: SsoConfig) {
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  const url = new URL(config.authorize_url)
  url.searchParams.set('client_id', config.client_id)
  url.searchParams.set('redirect_uri', config.redirect_uri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  window.location.href = url.toString()
}

/** 取出并清除本次登录的 state。 */
export function consumeSsoState(): string {
  const state = sessionStorage.getItem(STATE_KEY) ?? ''
  sessionStorage.removeItem(STATE_KEY)
  return state
}

/** 用回调中的 code 换 token；成功后写入本地会话。 */
export async function exchangeSsoCode(code: string, redirectUri: string): Promise<AdminSsoUser> {
  const response = await fetch('/api/auth/sso/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  })
  if (!response.ok) throw new Error(await readError(response))
  const body = (await response.json()) as SsoExchangeResponse
  if (!body.access_token || !body.user) throw new Error('SSO 返回数据不完整')
  saveSession(body.access_token, body.user)
  return body.user
}

/** 校验本地 token 是否仍有效；失效时清除本地会话。 */
export async function verifySsoSession(): Promise<AdminSsoUser | null> {
  const token = getSsoToken()
  if (!token) return null
  try {
    const response = await fetch('/api/auth/sso/me', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      clearSsoSession()
      return null
    }
    const body = (await response.json()) as { user?: AdminSsoUser }
    if (!body.user) {
      clearSsoSession()
      return null
    }
    saveSession(token, body.user)
    return body.user
  } catch {
    // 网络异常时不强制登出，保留本地会话，避免 SSO 短暂不可用导致无法进入
    return getSsoUser()
  }
}

export function logoutSso() {
  clearSsoSession()
}
