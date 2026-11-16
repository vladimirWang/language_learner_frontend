import { DownloadOutlined } from '@ant-design/icons'
import { Button, Descriptions, Space, Tag, Typography } from 'antd'
import { formatTime, isDownloadable } from '../api'
import type { Artifact, VersionInfo } from '../types'

interface ArtifactRowProps {
  artifact: Artifact
}

function ArtifactRow({ artifact }: ArtifactRowProps) {
  return (
    <Space direction="vertical" size={4}>
      <Typography.Text code copyable>
        {artifact.md5 || '—'}
      </Typography.Text>
      {isDownloadable(artifact.url) ? (
        <Button size="small" type="link" href={artifact.url} target="_blank" rel="noreferrer" icon={<DownloadOutlined />}>
          下载
        </Button>
      ) : (
        <Space size={4} wrap>
          <Tag>本地路径</Tag>
          <Typography.Text type="secondary" copyable style={{ fontSize: 12 }}>
            {artifact.url}
          </Typography.Text>
        </Space>
      )}
    </Space>
  )
}

export default function VersionDetail({ info }: { info: VersionInfo }) {
  return (
    <Descriptions
      bordered
      size="small"
      column={1}
      items={[
        {
          key: 'version',
          label: '版本号',
          children: <Typography.Text copyable>{info.version}</Typography.Text>,
        },
        {
          key: 'created_at',
          label: '构建时间',
          children: formatTime(info.created_at),
        },
        {
          key: 'ground_truth',
          label: '真值库 ground_truth.db',
          children: <ArtifactRow artifact={info.ground_truth} />,
        },
        {
          key: 'vector_snapshot',
          label: '向量快照 vectors.jsonl',
          children: <ArtifactRow artifact={info.vector_snapshot} />,
        },
      ]}
    />
  )
}
