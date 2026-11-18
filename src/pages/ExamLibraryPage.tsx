import {
  App as AntApp,
  Card,
  Col,
  Empty,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  type TableProps,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { api, errorMessage } from '../api'
import type { ExamAdminPaper, ExamDiktat, ExamWriting, PdfExamQuestion } from '../types'

const SECTION_LABELS: Record<string, string> = {
  hoeren: '听力理解',
  lesen: '阅读理解',
  grammar: '语法与词汇',
  diktat: '听写',
  writing: '书面表达',
  unknown: '未分类',
}

const ANSWER_OPTIONS = [
  { value: '', label: '未绑定' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
]

/** 德专四级题库：试卷/题目浏览、标准答案绑定、听写与写作查看。 */
export default function ExamLibraryPage() {
  const { message } = AntApp.useApp()
  const [papers, setPapers] = useState<ExamAdminPaper[]>([])
  const [paperId, setPaperId] = useState<string>()
  const [questions, setQuestions] = useState<PdfExamQuestion[]>([])
  const [diktat, setDiktat] = useState<ExamDiktat[]>([])
  const [writing, setWriting] = useState<ExamWriting[]>([])
  const [section, setSection] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .examAdminPapers()
      .then(({ papers: list }) => {
        if (cancelled) return
        setPapers(list)
        if (list.length > 0) setPaperId(list[0].paper_id)
      })
      .catch((error) => {
        if (!cancelled) message.error('加载试卷失败：' + errorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [message])

  useEffect(() => {
    if (!paperId) return
    let cancelled = false
    setDetailLoading(true)
    setSection(undefined)
    Promise.all([
      api.examAdminQuestions(paperId),
      api.examDiktat(paperId),
      api.examWriting(paperId),
    ])
      .then(([questionResult, diktatResult, writingResult]) => {
        if (cancelled) return
        setQuestions(questionResult.questions)
        setDiktat(diktatResult.diktat)
        setWriting(writingResult.writing)
      })
      .catch((error) => {
        if (!cancelled) message.error('加载题库失败：' + errorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [paperId, message])

  const sections = useMemo(
    () => Array.from(new Set(questions.map((item) => item.section))),
    [questions],
  )
  const visibleQuestions = useMemo(
    () => (section ? questions.filter((item) => item.section === section) : questions),
    [questions, section],
  )

  const bindAnswer = async (record: PdfExamQuestion, value: string) => {
    try {
      const result = await api.updateExamAnswer({
        paper_id: record.paper_id,
        section: record.section,
        q_no: record.q_no,
        correct_answer: value,
      })
      const next = questions.map((item) =>
        item.section === record.section && item.q_no === record.q_no
          ? { ...item, correct_answer: result.question.correct_answer ?? null }
          : item,
      )
      setQuestions(next)
      const answeredCount = next.filter((item) => item.correct_answer).length
      setPapers((prev) =>
        prev.map((item) =>
          item.paper_id === record.paper_id
            ? { ...item, answered_count: answeredCount }
            : item,
        ),
      )
      message.success(value ? `第 ${record.q_no} 题已绑定 ${value}` : `第 ${record.q_no} 题已解除绑定`)
    } catch (error) {
      message.error('保存失败：' + errorMessage(error))
    }
  }

  const columns: TableProps<PdfExamQuestion>['columns'] = [
    {
      title: '题型',
      dataIndex: 'section',
      width: 110,
      render: (value: string) => <Tag>{SECTION_LABELS[value] ?? value}</Tag>,
    },
    { title: '题号', dataIndex: 'q_no', width: 72 },
    {
      title: '题干',
      dataIndex: 'stem',
      render: (value: string) => (
        <Typography.Paragraph style={{ margin: 0, maxWidth: 460 }} ellipsis={{ rows: 3 }}>
          {value}
        </Typography.Paragraph>
      ),
    },
    {
      title: '选项',
      dataIndex: 'options',
      width: 360,
      render: (options: string[]) => (
        <Space direction="vertical" size={0}>
          {options.map((option) => (
            <Typography.Text key={option} style={{ fontSize: 12 }}>
              {option}
            </Typography.Text>
          ))}
        </Space>
      ),
    },
    {
      title: '标准答案',
      width: 130,
      render: (_, record) => (
        <Select
          size="small"
          style={{ width: 110 }}
          value={record.correct_answer ?? ''}
          options={ANSWER_OPTIONS}
          onChange={(value) => void bindAnswer(record, value)}
        />
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>
          德专四级题库
        </Typography.Title>
        <Typography.Text type="secondary">
          从已解析的 PDF 试卷中浏览题目、绑定标准答案，并查看听写与写作数据。
        </Typography.Text>
      </div>

      <Spin spinning={loading}>
        <Row gutter={16} align="top">
          <Col flex="320px">
            <Card size="small" title={`试卷（${papers.length}）`}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {papers.map((paper) => {
                  const active = paper.paper_id === paperId
                  return (
                    <button
                      key={paper.paper_id}
                      type="button"
                      onClick={() => setPaperId(paper.paper_id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: active ? '1px solid #1677ff' : '1px solid #f0f0f0',
                        background: active ? '#e6f4ff' : '#fff',
                        borderRadius: 8,
                        padding: '10px 12px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {paper.title || paper.paper_id}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        {paper.question_count ?? 0} 题 · 已绑定 {paper.answered_count ?? 0} · 听写{' '}
                        {paper.diktat_count ?? 0} · 写作 {paper.writing_count ?? 0}
                      </div>
                    </button>
                  )
                })}
                {papers.length === 0 && <Empty description="暂无已解析试卷" />}
              </Space>
            </Card>
          </Col>

          <Col flex="auto" style={{ minWidth: 0 }}>
            <Card size="small">
              <Tabs
                items={[
                  {
                    key: 'questions',
                    label: `客观题（${questions.length}）`,
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Space>
                          <Typography.Text type="secondary">题型筛选</Typography.Text>
                          <Select
                            allowClear
                            size="small"
                            style={{ width: 160 }}
                            placeholder="全部题型"
                            value={section}
                            onChange={setSection}
                            options={sections.map((item) => ({
                              value: item,
                              label: SECTION_LABELS[item] ?? item,
                            }))}
                          />
                        </Space>
                        <Table<PdfExamQuestion>
                          rowKey={(record) => `${record.section}-${record.q_no}`}
                          size="small"
                          loading={detailLoading}
                          columns={columns}
                          dataSource={visibleQuestions}
                          pagination={{ pageSize: 20, showSizeChanger: false }}
                          scroll={{ x: 960 }}
                        />
                      </Space>
                    ),
                  },
                  {
                    key: 'diktat',
                    label: `听写（${diktat.length}）`,
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {diktat.map((item) => (
                          <Card
                            key={`${item.paper_id}-${item.word_count}`}
                            size="small"
                            title={`听写原文 · ${item.word_count} 词`}
                          >
                            <Typography.Paragraph
                              style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                            >
                              {item.full_text}
                            </Typography.Paragraph>
                          </Card>
                        ))}
                        {diktat.length === 0 && <Empty description="该套卷暂无听写数据" />}
                      </Space>
                    ),
                  },
                  {
                    key: 'writing',
                    label: `写作（${writing.length}）`,
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {writing.map((item) => (
                          <Card
                            key={`${item.paper_id}-${item.prompt.slice(0, 16)}`}
                            size="small"
                            title={`书面表达${item.word_limit ? ` · 约 ${item.word_limit} 词` : ''}`}
                          >
                            <Typography.Paragraph
                              style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}
                            >
                              {item.prompt}
                            </Typography.Paragraph>
                          </Card>
                        ))}
                        {writing.length === 0 && <Empty description="该套卷暂无写作数据" />}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </Space>
  )
}
