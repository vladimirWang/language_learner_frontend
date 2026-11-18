import SparkMD5 from 'spark-md5'

type Task<T> = Promise<T> | (() => Promise<T>)

/**
 * 分块计算文件 MD5，避免一次性把大文件读进内存。
 * 用于上传前去重：相同内容的文件直接复用已有导入任务。
 */
export async function computeFileMD5(
  file: Blob,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const chunkSize = 4 * 1024 * 1024
  const spark = new SparkMD5.ArrayBuffer()
  const total = Math.ceil(file.size / chunkSize) || 1
  for (let index = 0; index < total; index += 1) {
    const buffer = await file
      .slice(index * chunkSize, Math.min((index + 1) * chunkSize, file.size))
      .arrayBuffer()
    spark.append(buffer)
    onProgress?.(Math.round(((index + 1) / total) * 100))
  }
  return spark.end()
}

/**
 * 控制并发执行一组任务，每完成一个再取下一个。
 * 单个任务失败会重试，达到最大尝试次数后停止调度并 reject。
 *
 * @param tasks 任务工厂（推荐）或 Promise；Promise 会在传入时立即开始执行，无法真正限流
 * @param limit 最大并发数
 * @param maxAttempts 单个任务最多尝试次数（含首次），默认 3
 */
export async function runWithConcurrency<T>(
  tasks: Task<T>[],
  limit: number,
  maxAttempts = 3,
): Promise<T[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('limit must be a positive integer')
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer')
  }

  const results = new Array<T>(tasks.length)
  let nextIndex = 0
  let fatalError: unknown = null

  const runTask = async (task: () => Promise<T>, index: number): Promise<void> => {
    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        results[index] = await task()
        return
      } catch (error) {
        lastError = error
      }
    }
    fatalError = lastError
    throw lastError
  }

  const worker = async (): Promise<void> => {
    while (fatalError === null) {
      const index = nextIndex
      nextIndex += 1
      if (index >= tasks.length) return
      const task = tasks[index]
      await runTask(
        typeof task === 'function' ? task : () => task,
        index,
      )
    }
  }

  const workerCount = Math.min(limit, tasks.length)
  const settled = await Promise.allSettled(
    Array.from({ length: workerCount }, () => worker()),
  )
  const failed = settled.find(
    (item): item is PromiseRejectedResult => item.status === 'rejected',
  )
  if (failed) throw failed.reason
  if (fatalError !== null) throw fatalError
  return results
}
