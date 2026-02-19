export interface HelpDoc {
  readonly description: string
  readonly usage: string
  readonly flags: ReadonlyArray<FlagDoc>
  readonly args?: ReadonlyArray<ArgDoc>
  readonly subcommands?: ReadonlyArray<SubcommandDoc>
}

export interface FlagDoc {
  readonly name: string
  readonly aliases: ReadonlyArray<string>
  readonly type: string
  readonly description: string | undefined
  readonly required: boolean
}

export interface SubcommandDoc {
  readonly name: string
  readonly description: string
}

export interface ArgDoc {
  readonly name: string
  readonly type: string
  readonly description: string | undefined
  readonly required: boolean
  readonly variadic: boolean
}

export const formatHelpDoc = (doc: HelpDoc): string => {
  const sections: Array<string> = []
  if (doc.description) { sections.push("DESCRIPTION"); sections.push(`  ${doc.description}`); sections.push("") }
  sections.push("USAGE"); sections.push(`  ${doc.usage}`); sections.push("")
  if (doc.args && doc.args.length > 0) {
    sections.push("ARGUMENTS")
    for (const a of doc.args) {
      let n = a.name + (a.variadic ? "..." : "")
      const opt = a.required ? "" : " (optional)"
      sections.push(`  ${n} ${a.type}    ${(a.description ?? "") + opt}`)
    }
    sections.push("")
  }
  if (doc.flags.length > 0) {
    sections.push("FLAGS")
    for (const f of doc.flags) {
      const names = [`--${f.name}`, ...f.aliases].join(", ")
      const tp = f.type !== "boolean" ? ` ${f.type}` : ""
      sections.push(`  ${names}${tp}    ${f.description ?? ""}`)
    }
    sections.push("")
  }
  if (doc.subcommands && doc.subcommands.length > 0) {
    sections.push("SUBCOMMANDS")
    for (const s of doc.subcommands) sections.push(`  ${s.name}    ${s.description}`)
    sections.push("")
  }
  if (sections[sections.length - 1] === "") sections.pop()
  return sections.join("\n")
}

export const formatVersion = (name: string, version: string): string => `${name} v${version}`
