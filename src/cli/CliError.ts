import * as Predicate from "effect/Predicate"

const CliErrorTypeId = "~effect-start/Cli/CliError"

export const isCliError = (u: unknown): u is CliError => Predicate.hasProperty(u, CliErrorTypeId)

export type CliErrorReason =
  | "UnrecognizedOption"
  | "DuplicateOption"
  | "MissingOption"
  | "MissingArgument"
  | "InvalidValue"
  | "UnknownSubcommand"
  | "ShowHelp"
  | "UserError"

const suggestText = (suggestions: ReadonlyArray<string>) =>
  suggestions.length > 0 ? `\n\n  Did you mean this?\n    ${suggestions.join("\n    ")}` : ""

const formatMessage = (reason: CliErrorReason, props: Record<string, any>): string => {
  switch (reason) {
    case "UnrecognizedOption": {
      const base = props.command
        ? `Unrecognized flag: ${props.option} in command ${props.command.join(" ")}`
        : `Unrecognized flag: ${props.option}`
      return base + suggestText(props.suggestions ?? [])
    }
    case "DuplicateOption":
      return `Duplicate flag "${props.option}" in parent "${props.parentCommand}" and subcommand "${props.childCommand}".`
    case "MissingOption":
      return `Missing required flag: --${props.option}`
    case "MissingArgument":
      return `Missing required argument: ${props.argument}`
    case "InvalidValue":
      return props.kind === "argument"
        ? `Invalid value for argument <${props.option}>: "${props.value}". Expected: ${props.expected}`
        : `Invalid value for flag --${props.option}: "${props.value}". Expected: ${props.expected}`
    case "UnknownSubcommand": {
      const base = props.parent
        ? `Unknown subcommand "${props.subcommand}" for "${props.parent.join(" ")}"`
        : `Unknown subcommand "${props.subcommand}"`
      return base + suggestText(props.suggestions ?? [])
    }
    case "ShowHelp":
      return "Help requested"
    case "UserError":
      return String(props.cause)
  }
}

export class CliError {
  readonly _tag = "CliError"
  readonly [CliErrorTypeId] = CliErrorTypeId
  readonly reason: CliErrorReason
  constructor(props: { reason: CliErrorReason } & Record<string, any>) {
    this.reason = props.reason
    Object.assign(this, props)
  }
  get message(): string {
    return formatMessage(this.reason, this as any)
  }
}

export const formatErrors = (errors: ReadonlyArray<CliError>): string => {
  if (errors.length === 0) return ""
  if (errors.length === 1) return `\nERROR\n  ${errors[0].message}`
  return `\nERRORS\n` + errors.map((e) => `  ${e.message}`).join("\n")
}
