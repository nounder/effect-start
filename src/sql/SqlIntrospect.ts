import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as SqlClient from "./SqlClient.ts"

export interface Column {
  readonly tableSchema: string
  readonly tableName: string
  readonly columnName: string
  readonly ordinalPosition: number
  readonly columnDefault: string | null
  readonly isNullable: boolean
  readonly dataType: string
  readonly maxLength: number | null
  readonly isPrimaryKey: boolean
  readonly isAutoIncrement: boolean
  readonly isSortable: boolean
}

export interface ForeignKey {
  readonly constraintName: string
  readonly tableSchema: string
  readonly tableName: string
  readonly columnName: string
  readonly referencedSchema: string
  readonly referencedTable: string
  readonly referencedColumn: string
  readonly updateRule: string
  readonly deleteRule: string
}

export interface Index {
  readonly tableSchema: string
  readonly tableName: string
  readonly indexName: string
  readonly columnName: string
  readonly isUnique: boolean
  readonly ordinalPosition: number
}

export interface Table {
  readonly tableSchema: string
  readonly tableName: string
  readonly columns: ReadonlyArray<Column>
  readonly foreignKeys: ReadonlyArray<ForeignKey>
  readonly indexes: ReadonlyArray<Index>
}

export interface DatabaseSchema {
  readonly tables: ReadonlyArray<Table>
}

export interface IntrospectOptions {
  readonly foreignKeys?: boolean
  readonly indexes?: boolean
}

const sqliteColumns = `
  SELECT
    '' as tableSchema,
    m.name as tableName,
    p.name as columnName,
    p.cid + 1 as ordinalPosition,
    p.dflt_value as columnDefault,
    CASE WHEN p."notnull" = 0 THEN 1 ELSE 0 END as isNullable,
    p.type as dataType,
    NULL as maxLength,
    p.pk as isPrimaryKey,
    CASE WHEN p.pk = 1 AND lower(p.type) = 'integer' THEN 1 ELSE 0 END as isAutoIncrement
  FROM sqlite_master m
  JOIN pragma_table_info(m.name) p
  WHERE m.type = 'table'
    AND m.name NOT LIKE 'sqlite_%'
  ORDER BY m.name, p.cid
`

const sqliteForeignKeys = `
  SELECT
    '' as constraintName,
    '' as tableSchema,
    m.name as tableName,
    fk."from" as columnName,
    '' as referencedSchema,
    fk."table" as referencedTable,
    fk."to" as referencedColumn,
    fk.on_update as updateRule,
    fk.on_delete as deleteRule
  FROM sqlite_master m
  JOIN pragma_foreign_key_list(m.name) fk
  WHERE m.type = 'table'
    AND m.name NOT LIKE 'sqlite_%'
  ORDER BY m.name, fk.seq
`

const sqliteIndexes = `
  SELECT
    '' as tableSchema,
    m.name as tableName,
    il.name as indexName,
    ii.name as columnName,
    il."unique" as isUnique,
    ii.seqno + 1 as ordinalPosition
  FROM sqlite_master m
  JOIN pragma_index_list(m.name) il
  JOIN pragma_index_info(il.name) ii
  WHERE m.type = 'table'
    AND m.name NOT LIKE 'sqlite_%'
  ORDER BY m.name, il.name, ii.seqno
`

const postgresColumns = `
  SELECT
    c.table_schema as "tableSchema",
    c.table_name as "tableName",
    c.column_name as "columnName",
    c.ordinal_position as "ordinalPosition",
    c.column_default as "columnDefault",
    CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as "isNullable",
    c.data_type as "dataType",
    c.character_maximum_length as "maxLength",
    CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as "isPrimaryKey",
    CASE WHEN c.column_default LIKE 'nextval(%' THEN true ELSE false END as "isAutoIncrement"
  FROM information_schema.columns c
  LEFT JOIN (
    SELECT kcu.table_schema, kcu.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
  ) pk
    ON c.table_schema = pk.table_schema
    AND c.table_name = pk.table_name
    AND c.column_name = pk.column_name
  WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog')
  ORDER BY c.table_schema, c.table_name, c.ordinal_position
`

const postgresForeignKeys = `
  SELECT
    tc.constraint_name as "constraintName",
    tc.table_schema as "tableSchema",
    tc.table_name as "tableName",
    kcu.column_name as "columnName",
    ccu.table_schema as "referencedSchema",
    ccu.table_name as "referencedTable",
    ccu.column_name as "referencedColumn",
    rc.update_rule as "updateRule",
    rc.delete_rule as "deleteRule"
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
  JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')
  ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
`

const postgresIndexes = `
  SELECT
    n.nspname as "tableSchema",
    t.relname as "tableName",
    i.relname as "indexName",
    a.attname as "columnName",
    ix.indisunique as "isUnique",
    array_position(ix.indkey, a.attnum) as "ordinalPosition"
  FROM pg_index ix
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid
    AND a.attnum = ANY(ix.indkey)
  WHERE n.nspname NOT IN ('information_schema', 'pg_catalog')
  ORDER BY n.nspname, t.relname, i.relname, array_position(ix.indkey, a.attnum)
`

const mssqlColumns = `
  SELECT
    s.name as tableSchema,
    t.name as tableName,
    c.name as columnName,
    c.column_id as ordinalPosition,
    dc.definition as columnDefault,
    c.is_nullable as isNullable,
    tp.name as dataType,
    c.max_length as maxLength,
    CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END as isPrimaryKey,
    c.is_identity as isAutoIncrement
  FROM sys.tables t
  JOIN sys.schemas s ON t.schema_id = s.schema_id
  JOIN sys.columns c ON t.object_id = c.object_id
  JOIN sys.types tp ON c.user_type_id = tp.user_type_id
  LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
  LEFT JOIN (
    SELECT ic.object_id, ic.column_id
    FROM sys.index_columns ic
    JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    WHERE i.is_primary_key = 1
  ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
  WHERE t.is_ms_shipped = 0
  ORDER BY s.name, t.name, c.column_id
`

const mssqlForeignKeys = `
  SELECT
    fk.name as constraintName,
    s.name as tableSchema,
    t.name as tableName,
    c.name as columnName,
    rs.name as referencedSchema,
    rt.name as referencedTable,
    rc.name as referencedColumn,
    fk.update_referential_action_desc as updateRule,
    fk.delete_referential_action_desc as deleteRule
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
  JOIN sys.tables t ON fkc.parent_object_id = t.object_id
  JOIN sys.schemas s ON t.schema_id = s.schema_id
  JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
  JOIN sys.tables rt ON fkc.referenced_object_id = rt.object_id
  JOIN sys.schemas rs ON rt.schema_id = rs.schema_id
  JOIN sys.columns rc ON fkc.referenced_object_id = rc.object_id AND fkc.referenced_column_id = rc.column_id
  WHERE t.is_ms_shipped = 0
  ORDER BY s.name, t.name, fkc.constraint_column_id
`

const mssqlIndexes = `
  SELECT
    s.name as tableSchema,
    t.name as tableName,
    i.name as indexName,
    c.name as columnName,
    i.is_unique as isUnique,
    ic.key_ordinal as ordinalPosition
  FROM sys.indexes i
  JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
  JOIN sys.tables t ON i.object_id = t.object_id
  JOIN sys.schemas s ON t.schema_id = s.schema_id
  JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
  WHERE t.is_ms_shipped = 0
    AND i.name IS NOT NULL
    AND i.is_primary_key = 0
    AND ic.is_included_column = 0
  ORDER BY s.name, t.name, i.name, ic.key_ordinal
`

export type Dialect = "sqlite" | "postgres" | "mssql"

const dialectQueries: Record<Dialect, { columns: string; foreignKeys: string; indexes: string }> = {
  sqlite: { columns: sqliteColumns, foreignKeys: sqliteForeignKeys, indexes: sqliteIndexes },
  postgres: {
    columns: postgresColumns,
    foreignKeys: postgresForeignKeys,
    indexes: postgresIndexes,
  },
  mssql: { columns: mssqlColumns, foreignKeys: mssqlForeignKeys, indexes: mssqlIndexes },
}

const singleColumnIndexes = (indexes: ReadonlyArray<Index>): Set<string> => {
  const countByIndex = new Map<string, { count: number; columnName: string }>()
  for (const idx of indexes) {
    const key = `${idx.tableSchema}.${idx.tableName}.${idx.indexName}`
    const existing = countByIndex.get(key)
    if (existing) {
      existing.count++
    } else {
      countByIndex.set(key, { count: 1, columnName: idx.columnName })
    }
  }
  const result = new Set<string>()
  for (const [key, entry] of countByIndex) {
    if (entry.count === 1) {
      const tableKey = key.substring(0, key.lastIndexOf("."))
      result.add(`${tableKey}.${entry.columnName}`)
    }
  }
  return result
}

const groupByTable = (
  columns: ReadonlyArray<Omit<Column, "isSortable">>,
  foreignKeys: ReadonlyArray<ForeignKey>,
  indexes: ReadonlyArray<Index>,
): ReadonlyArray<Table> => {
  const sortable = singleColumnIndexes(indexes)
  const tableMap = new Map<string, Table>()
  for (const col of columns) {
    const key = `${col.tableSchema}.${col.tableName}`
    const fullCol: Column = {
      ...col,
      isSortable: col.isPrimaryKey || sortable.has(`${key}.${col.columnName}`),
    }
    const existing = tableMap.get(key)
    if (existing) {
      ;(existing.columns as Array<Column>).push(fullCol)
    } else {
      tableMap.set(key, {
        tableSchema: col.tableSchema,
        tableName: col.tableName,
        columns: [fullCol],
        foreignKeys: [],
        indexes: [],
      })
    }
  }
  for (const fk of foreignKeys) {
    const key = `${fk.tableSchema}.${fk.tableName}`
    const table = tableMap.get(key)
    if (table) {
      ;(table.foreignKeys as Array<ForeignKey>).push(fk)
    }
  }
  for (const idx of indexes) {
    const key = `${idx.tableSchema}.${idx.tableName}`
    const table = tableMap.get(key)
    if (table) {
      ;(table.indexes as Array<Index>).push(idx)
    }
  }
  return Array.from(tableMap.values())
}

const normalizeBooleans = (columns: ReadonlyArray<Column>): ReadonlyArray<Column> =>
  columns.map((c) => ({
    ...c,
    isNullable: Boolean(c.isNullable),
    isPrimaryKey: Boolean(c.isPrimaryKey),
    isAutoIncrement: Boolean(c.isAutoIncrement),
  }))

export const introspect = (
  dialect: Dialect,
  options?: IntrospectOptions,
): Effect.Effect<DatabaseSchema, SqlClient.SqlError, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const q = dialectQueries[dialect]
    const columns = normalizeBooleans(yield* sql.unsafe<Column>(q.columns))
    const foreignKeys =
      options?.foreignKeys !== false ? yield* sql.unsafe<ForeignKey>(q.foreignKeys) : []
    const indexes =
      options?.indexes !== false
        ? (yield* sql.unsafe<Index>(q.indexes)).map((i) => ({
            ...i,
            isUnique: Boolean(i.isUnique),
          }))
        : []
    return { tables: groupByTable(columns, foreignKeys, indexes) }
  })

const dataTypeToSchema = (dataType: string): Schema.Schema.Any | null => {
  const t = dataType.toLowerCase()
  if (
    t === "integer" ||
    t === "int" ||
    t === "int4" ||
    t === "int8" ||
    t === "smallint" ||
    t === "tinyint" ||
    t === "mediumint" ||
    t === "bigint" ||
    t === "int2"
  )
    return Schema.Number
  if (
    t === "real" ||
    t === "double" ||
    t === "double precision" ||
    t === "float" ||
    t === "float4" ||
    t === "float8" ||
    t === "numeric" ||
    t === "decimal" ||
    t === "money" ||
    t === "smallmoney"
  )
    return Schema.Number
  if (
    t === "text" ||
    t === "varchar" ||
    t === "char" ||
    t === "nchar" ||
    t === "nvarchar" ||
    t === "ntext" ||
    t === "character varying" ||
    t === "character" ||
    t === "bpchar" ||
    t === "uuid" ||
    t === "citext" ||
    t === "name" ||
    t === "xml"
  )
    return Schema.String
  if (t === "boolean" || t === "bool" || t === "bit")
    return Schema.Union(Schema.Boolean, Schema.Number)
  if (
    t === "timestamp" ||
    t === "timestamptz" ||
    t === "timestamp with time zone" ||
    t === "timestamp without time zone" ||
    t === "date" ||
    t === "datetime" ||
    t === "datetime2" ||
    t === "smalldatetime" ||
    t === "datetimeoffset" ||
    t === "time"
  )
    return Schema.String
  if (t === "json" || t === "jsonb") return Schema.Unknown
  if (t === "blob" || t === "bytea" || t === "varbinary" || t === "binary" || t === "image")
    return null
  return null
}

const columnToSchema = (col: Column): Schema.Schema.Any | Schema.PropertySignature.All | null => {
  const base = dataTypeToSchema(col.dataType)
  if (base === null) return null
  if (col.isNullable) return Schema.NullOr(base)
  return base
}

export interface TableSchema {
  readonly tableName: string
  readonly tableSchema: string
  readonly schema: Schema.Schema<any, any, never>
  readonly columns: ReadonlyArray<Column>
}

export const tableToSchema = (table: Table): TableSchema | null => {
  const fields: Record<string, Schema.Schema<any, any, never>> = {}
  let hasFields = false
  for (const col of table.columns) {
    const s = columnToSchema(col)
    if (s === null) continue
    fields[col.columnName] = s as Schema.Schema<any, any, never>
    hasFields = true
  }
  if (!hasFields) return null
  return {
    tableName: table.tableName,
    tableSchema: table.tableSchema,
    schema: Schema.Struct(fields),
    columns: table.columns.filter((c) => columnToSchema(c) !== null),
  }
}

export const toSchemas = (db: DatabaseSchema): ReadonlyArray<TableSchema> =>
  db.tables.flatMap((t) => {
    const s = tableToSchema(t)
    return s ? [s] : []
  })

export interface SortOrder {
  readonly column: string
  readonly reverse?: boolean
}

export interface Filter {
  readonly column: string
  readonly op: "eq" | "neq"
  readonly value: unknown
}

export interface FindAllOptions {
  readonly limit?: number
  readonly offset?: number
  readonly sort?: ReadonlyArray<SortOrder>
  readonly filters?: ReadonlyArray<Filter>
}

export interface TableReader {
  readonly tableName: string
  readonly tableSchema: string
  readonly schema: Schema.Schema<any, any, never>
  readonly columns: ReadonlyArray<Column>
  readonly sortableColumns: ReadonlyArray<string>
  readonly findAll: (
    options?: FindAllOptions,
  ) => Effect.Effect<ReadonlyArray<unknown>, SqlClient.SqlError, SqlClient.SqlClient>
  readonly findById: (
    id: unknown,
  ) => Effect.Effect<unknown | null, SqlClient.SqlError, SqlClient.SqlClient>
  readonly count: (options?: {
    readonly filters?: ReadonlyArray<Filter>
  }) => Effect.Effect<number, SqlClient.SqlError, SqlClient.SqlClient>
}

export interface DatabaseReader {
  readonly tables: ReadonlyArray<TableReader>
  readonly table: (name: string) => TableReader | undefined
}

const escapeIdentifier = (id: string): string => `"${id.replace(/"/g, '""')}"`

const concatSql = (
  sql: SqlClient.Connection,
  fragments: Array<{ strings: ReadonlyArray<string>; values: Array<unknown> }>,
): Effect.Effect<ReadonlyArray<unknown>, SqlClient.SqlError> => {
  const strings: Array<string> = []
  const values: Array<unknown> = []
  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i]
    for (let j = 0; j < frag.strings.length; j++) {
      if (j === 0 && strings.length > 0) {
        strings[strings.length - 1] += frag.strings[j]
      } else {
        strings.push(frag.strings[j])
      }
      if (j < frag.values.length) values.push(frag.values[j])
    }
  }
  const tsa = Object.assign([...strings], { raw: strings }) as unknown as TemplateStringsArray
  return sql(tsa, ...values)
}

const literal = (text: string) => ({ strings: [text], values: [] as Array<unknown> })

const param = (value: unknown) => ({ strings: ["", ""], values: [value] })

const buildWhereFragments = (
  filters: ReadonlyArray<Filter>,
  columnSet: Set<string>,
): Array<{ strings: ReadonlyArray<string>; values: Array<unknown> }> => {
  const parts: Array<{ strings: ReadonlyArray<string>; values: Array<unknown> }> = []
  const valid = filters.filter((f) => columnSet.has(f.column))
  if (valid.length === 0) return parts
  parts.push(literal(" WHERE "))
  for (let i = 0; i < valid.length; i++) {
    if (i > 0) parts.push(literal(" AND "))
    const f = valid[i]
    const col = escapeIdentifier(f.column)
    if (f.value === null) {
      parts.push(literal(f.op === "eq" ? `${col} IS NULL` : `${col} IS NOT NULL`))
    } else {
      parts.push(literal(`${col} ${f.op === "eq" ? "=" : "!="} `))
      parts.push(param(f.value))
    }
  }
  return parts
}

const makeTableReader = (ts: TableSchema): TableReader => {
  const qualifiedName = ts.tableSchema
    ? `${escapeIdentifier(ts.tableSchema)}.${escapeIdentifier(ts.tableName)}`
    : escapeIdentifier(ts.tableName)
  const primaryKey = ts.columns.find((c) => c.isPrimaryKey)
  const selectCols = ts.columns.map((c) => escapeIdentifier(c.columnName)).join(", ")
  const columnSet = new Set(ts.columns.map((c) => c.columnName))
  const sortableSet = new Set(ts.columns.filter((c) => c.isSortable).map((c) => c.columnName))

  return {
    tableName: ts.tableName,
    tableSchema: ts.tableSchema,
    schema: ts.schema,
    columns: ts.columns,
    sortableColumns: Array.from(sortableSet),
    findAll: (options) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const fragments: Array<{ strings: ReadonlyArray<string>; values: Array<unknown> }> = [
          literal(`SELECT ${selectCols} FROM ${qualifiedName}`),
        ]
        if (options?.filters) {
          fragments.push(...buildWhereFragments(options.filters, columnSet))
        }
        if (options?.sort && options.sort.length > 0) {
          const sortClauses = options.sort
            .filter((s) => sortableSet.has(s.column))
            .map((s) => `${escapeIdentifier(s.column)} ${s.reverse ? "DESC" : "ASC"}`)
          if (sortClauses.length > 0) fragments.push(literal(` ORDER BY ${sortClauses.join(", ")}`))
        }
        if (options?.limit !== undefined)
          fragments.push(literal(` LIMIT ${Math.trunc(Number(options.limit))}`))
        if (options?.offset !== undefined)
          fragments.push(literal(` OFFSET ${Math.trunc(Number(options.offset))}`))
        return yield* concatSql(sql, fragments)
      }),
    findById: (id) =>
      Effect.gen(function* () {
        if (!primaryKey) return null
        const sql = yield* SqlClient.SqlClient
        const pkCol = escapeIdentifier(primaryKey.columnName)
        const rows = yield* concatSql(sql, [
          literal(`SELECT ${selectCols} FROM ${qualifiedName} WHERE ${pkCol} = `),
          param(id),
        ])
        return rows[0] ?? null
      }),
    count: (options) =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const fragments: Array<{ strings: ReadonlyArray<string>; values: Array<unknown> }> = [
          literal(`SELECT COUNT(*) as count FROM ${qualifiedName}`),
        ]
        if (options?.filters) {
          fragments.push(...buildWhereFragments(options.filters, columnSet))
        }
        const rows = yield* concatSql(sql, fragments)
        return Number((rows[0] as any).count)
      }),
  }
}

export const makeDatabaseReader = (db: DatabaseSchema): DatabaseReader => {
  const schemas = toSchemas(db)
  const readers = schemas.map(makeTableReader)
  return {
    tables: readers,
    table: (name) => readers.find((r) => r.tableName === name),
  }
}
