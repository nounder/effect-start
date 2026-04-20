import * as Predicate from "effect/Predicate"

const TypeId = "~effect-start/Cli/CliError"

export const isCliError = (u: unknown): u is CliError => Predicate.hasProperty(u, TypeId)

export type CliError =
  | UnrecognizedOption
  | DuplicateOption
  | MissingOption
  | MissingArgument
  | InvalidValue
  | UnknownSubcommand
  | ShowHelp
  | UserError

const suggestText = (suggestions: ReadonlyArray<string>) =>
  suggestions.length > 0 ? `\n\n  Did you mean this?\n    ${suggestions.join("\n    ")}` : ""

export class UnrecognizedOption {
  readonly _tag = "UnrecognizedOption"
  readonly [TypeId] = TypeId
  readonly option: string
  readonly command: ReadonlyArray<string> | undefined
  readonly suggestions: ReadonlyArray<string>
  constructor(props: {
    option: string
    command?: ReadonlyArray<string>
    suggestions?: ReadonlyArray<string>
  }) {
    this.option = props.option
    this.command = props.command
    this.suggestions = props.suggestions ?? []
  }
  get message(): string {
    const base = this.command
      ? `Unrecognized flag: ${this.option} in command ${this.command.join(" ")}`
      : `Unrecognized flag: ${this.option}`
    return base + suggestText(this.suggestions)
  }
}

export class DuplicateOption {
  readonly _tag = "DuplicateOption"
  readonly [TypeId] = TypeId
  readonly option: string
  readonly parentCommand: string
  readonly childCommand: string
  constructor(props: { option: string; parentCommand: string; childCommand: string }) {
    this.option = props.option
    this.parentCommand = props.parentCommand
    this.childCommand = props.childCommand
  }
  get message(): string {
    return `Duplicate flag "${this.option}" in parent "${this.parentCommand}" and subcommand "${this.childCommand}".`
  }
}

export class MissingOption {
  readonly _tag = "MissingOption"
  readonly [TypeId] = TypeId
  readonly option: string
  constructor(props: { option: string }) {
    this.option = props.option
  }
  get message(): string {
    return `Missing required flag: --${this.option}`
  }
}

export class MissingArgument {
  readonly _tag = "MissingArgument"
  readonly [TypeId] = TypeId
  readonly argument: string
  constructor(props: { argument: string }) {
    this.argument = props.argument
  }
  get message(): string {
    return `Missing required argument: ${this.argument}`
  }
}

export class InvalidValue {
  readonly _tag = "InvalidValue"
  readonly [TypeId] = TypeId
  readonly option: string
  readonly value: string
  readonly expected: string
  readonly kind: "argument" | "flag"
  constructor(props: {
    option: string
    value: string
    expected: string
    kind: "argument" | "flag"
  }) {
    this.option = props.option
    this.value = props.value
    this.expected = props.expected
    this.kind = props.kind
  }
  get message(): string {
    return this.kind === "argument"
      ? `Invalid value for argument <${this.option}>: "${this.value}". Expected: ${this.expected}`
      : `Invalid value for flag --${this.option}: "${this.value}". Expected: ${this.expected}`
  }
}

export class UnknownSubcommand {
  readonly _tag = "UnknownSubcommand"
  readonly [TypeId] = TypeId
  readonly subcommand: string
  readonly parent: ReadonlyArray<string> | undefined
  readonly suggestions: ReadonlyArray<string>
  constructor(props: {
    subcommand: string
    parent?: ReadonlyArray<string>
    suggestions?: ReadonlyArray<string>
  }) {
    this.subcommand = props.subcommand
    this.parent = props.parent
    this.suggestions = props.suggestions ?? []
  }
  get message(): string {
    const base = this.parent
      ? `Unknown subcommand "${this.subcommand}" for "${this.parent.join(" ")}"`
      : `Unknown subcommand "${this.subcommand}"`
    return base + suggestText(this.suggestions)
  }
}

export class ShowHelp {
  readonly _tag = "ShowHelp"
  readonly [TypeId] = TypeId
  readonly commandPath: ReadonlyArray<string>
  constructor(props: { commandPath: ReadonlyArray<string> }) {
    this.commandPath = props.commandPath
  }
  get message(): string {
    return "Help requested"
  }
}

export class UserError {
  readonly _tag = "UserError"
  readonly [TypeId] = TypeId
  readonly cause: unknown
  constructor(props: { cause: unknown }) {
    this.cause = props.cause
  }
  get message(): string {
    return String(this.cause)
  }
}

export const formatErrors = (errors: ReadonlyArray<CliError>): string => {
  if (errors.length === 0) return ""
  if (errors.length === 1) return `\nERROR\n  ${errors[0].message}`
  return `\nERRORS\n` + errors.map((e) => `  ${e.message}`).join("\n")
}
