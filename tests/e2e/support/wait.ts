export async function waitFor<T>(
  fn: () => Promise<T | null | undefined>,
  {
    timeoutMs = 15_000,
    intervalMs = 250,
    description = "operation"
  }: { timeoutMs?: number; intervalMs?: number; description?: string } = {}
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result !== undefined && result !== null) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${description}`);
}
