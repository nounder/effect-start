export const isAgentHarness = (): boolean =>
  !process.stdout.isTTY && Boolean(
    process.env.AMP_THREAD_ID ||
      process.env.CLAUDECODE ||
      process.env.CURSOR_AGENT ||
      process.env.CODEX_THREAD_ID,
  )
