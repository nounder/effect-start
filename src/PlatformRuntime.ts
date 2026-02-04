/**
 * Are we running within an agent harness, like Claude Code?
 */
export function isAgentHarness() {
  return typeof process !== "undefined"
    && !process.stdout.isTTY
    && (
      process.env.CLAUDECODE
      || process.env.CURSOR_AGENT
    )
}
