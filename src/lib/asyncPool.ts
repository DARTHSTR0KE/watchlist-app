// Runs `worker` over `items` with at most `concurrency` in flight at once.
// A failed item is caught and reported via `onItemError` rather than
// aborting the whole batch, so one bad row doesn't stall everything else.
export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  options?: {
    onProgress?: (completed: number, total: number) => void
    onItemError?: (item: T, index: number, error: unknown) => void
  },
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length)
  let nextIndex = 0
  let completed = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      try {
        results[index] = await worker(items[index], index)
      } catch (error) {
        options?.onItemError?.(items[index], index, error)
      } finally {
        completed++
        options?.onProgress?.(completed, items.length)
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))

  return results
}
