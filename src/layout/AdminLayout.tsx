import { AudioOutlined, CloudDownloadOutlined, DashboardOutlined, ToolOutlined } from '@ant-design/icons'
import { Layout, Menu, Typography, type MenuProps } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: '概览' },
  { key: '/builds', icon: <ToolOutlined />, label: '构建任务' },
  { key: '/listening', icon: <AudioOutlined />, label: '听力导入' },
  { key: '/versions', icon: <CloudDownloadOutlined />, label: '版本查询' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedKey = location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`

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
