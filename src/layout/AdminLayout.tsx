import {
  AudioOutlined,
  CloudDownloadOutlined,
  DashboardOutlined,
  FlagOutlined,
  MessageOutlined,
  SoundOutlined,
  ToolOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Layout, Menu, Typography, type MenuProps } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: '概览' },
  { key: '/builds', icon: <ToolOutlined />, label: '构建任务' },
  {
    key: '/listening',
    icon: <AudioOutlined />,
    label: '听力导入',
    children: [
      { key: '/listening', icon: <AudioOutlined />, label: '新建导入' },
      { key: '/listening/jobs', icon: <UnorderedListOutlined />, label: '任务列表' },
    ],
  },
  { key: '/levels', icon: <FlagOutlined />, label: '关卡配置' },
  { key: '/speaking', icon: <SoundOutlined />, label: '口语题库' },
  { key: '/speaking-templates', icon: <MessageOutlined />, label: '口语话术' },
  { key: '/versions', icon: <CloudDownloadOutlined />, label: '版本查询' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedKey = location.pathname.startsWith('/listening') ? location.pathname : location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`

  return (
    <Layout className="app-shell">
      <Layout.Sider width={216} breakpoint="lg" collapsedWidth={64}>
        <div className="brand">
          <span className="brand-mark">L</span>
          <span className="brand-text">素材管理台</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['/listening']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="app-header">
          <Typography.Text strong>语言学习 Agent · 素材版本服务</Typography.Text>
          <Typography.Text type="secondary">构建 / 版本 / 下载</Typography.Text>
        </Layout.Header>
        <Layout.Content className="app-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
