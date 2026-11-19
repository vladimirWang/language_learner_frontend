import {
  AppstoreOutlined,
  AudioOutlined,
  CloudDownloadOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FlagOutlined,
  MessageOutlined,
  ReadOutlined,
  SoundOutlined,
  ToolOutlined,
  UnorderedListOutlined,
  ProfileOutlined,
} from '@ant-design/icons'
import { Button, Layout, Menu, Space, Typography, type MenuProps } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getSsoUser, logoutSso } from '../auth'

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
  { key: '/pdf-import', icon: <FileTextOutlined />, label: 'PDF 试卷导入' },
  { key: '/exam', icon: <ReadOutlined />, label: '德专四级题库' },
  {
    key: '/speaking',
    icon: <SoundOutlined />,
    label: '口语',
    children: [
      { key: '/speaking', icon: <SoundOutlined />, label: '口语题库' },
      { key: '/speaking/plans', icon: <AppstoreOutlined />, label: '口语方案' },
      { key: '/speaking/exam-parts', icon: <ProfileOutlined />, label: '考试配置' },
    ],
  },
  { key: '/speaking-templates', icon: <MessageOutlined />, label: '口语话术' },
  { key: '/versions', icon: <CloudDownloadOutlined />, label: '版本查询' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const selectedKey =
    location.pathname.startsWith('/listening') ||
    location.pathname.startsWith('/pdf-import') ||
    (location.pathname.startsWith('/speaking/') && location.pathname !== '/speaking')
      ? location.pathname.startsWith('/pdf-import')
        ? '/pdf-import'
        : location.pathname
      : location.pathname === '/'
        ? '/'
        : `/${location.pathname.split('/')[1]}`

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
          defaultOpenKeys={['/listening', '/speaking']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="app-header">
          <Typography.Text strong>语言学习 Agent · 素材版本服务</Typography.Text>
          <Space size={12}>
            <Typography.Text type="secondary">
              {getSsoUser()?.email ?? getSsoUser()?.username ?? ''}
            </Typography.Text>
            <Button
              size="small"
              onClick={() => {
                logoutSso()
                window.location.replace('/')
              }}
            >
              退出登录
            </Button>
          </Space>
        </Layout.Header>
        <Layout.Content className="app-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
