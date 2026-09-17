/**
 * SQL Query Builder - A type-safe utility for building parameterized SQL queries.
 * Prevents SQL injection by using parameterized queries and allowlists.
 */

type SortOrder = 'ASC' | 'DESC'

interface QueryBuilderOptions {
  table: string
  selectColumns?: string[]
}

interface WhereCondition {
  column: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'ILIKE' | 'IN' | 'ANY'
  value: unknown
}

interface QueryResult {
  query: string
  values: unknown[]
}

export class QueryBuilder {
  private table: string
  private selectColumns: string[]
  private conditions: WhereCondition[] = []
  private values: unknown[] = []
  private paramCount = 1
  private sortColumn?: string
  private sortOrder: SortOrder = 'ASC'
  private limitValue?: number
  private offsetValue?: number
  private groupByColumns: string[] = []

  constructor(options: QueryBuilderOptions) {
    this.table = options.table
    this.selectColumns = options.selectColumns || ['*']
  }

  /**
   * Add a WHERE condition.
   */
  where(column: string, operator: WhereCondition['operator'], value: unknown): this {
    if (value === undefined || value === null) {
      return this
    }
    this.conditions.push({ column, operator, value })
    return this
  }

  /**
   * Add a WHERE equals condition (shorthand for where(col, '=', val)).
   */
  whereEquals(column: string, value: unknown): this {
    return this.where(column, '=', value)
  }

  /**
   * Add a WHERE condition only if the value is truthy.
   */
  whereIf(
    condition: boolean,
    column: string,
    operator: WhereCondition['operator'],
    value: unknown
  ): this {
    if (condition && value !== undefined && value !== null) {
      this.conditions.push({ column, operator, value })
    }
    return this
  }

  /**
   * Set ORDER BY clause with validation.
   * @param column - Column to sort by
   * @param order - Sort order ('ASC' or 'DESC')
   * @param allowedColumns - Allowlist of valid columns to prevent injection
   */
  orderBy(
    column: string,
    order: 'asc' | 'desc' | 'ASC' | 'DESC',
    allowedColumns: readonly string[]
  ): this {
    const upperOrder = order.toUpperCase() as SortOrder
    this.sortOrder = upperOrder === 'DESC' ? 'DESC' : 'ASC'

    // Validate column against allowlist
    if (allowedColumns.includes(column)) {
      this.sortColumn = column
    } else {
      // Use first allowed column as safe default
      this.sortColumn = allowedColumns[0]
    }
    return this
  }

  /**
   * Set LIMIT clause.
   */
  limit(value: number): this {
    this.limitValue = Math.max(0, Math.floor(value))
    return this
  }

  /**
   * Set OFFSET clause.
   */
  offset(value: number): this {
    this.offsetValue = Math.max(0, Math.floor(value))
    return this
  }

  /**
   * Set pagination (LIMIT and OFFSET).
   */
  paginate(page: number, perPage: number): this {
    this.limitValue = Math.max(1, Math.floor(perPage))
    this.offsetValue = (Math.max(1, Math.floor(page)) - 1) * this.limitValue
    return this
  }

  /**
   * Set GROUP BY clause.
   */
  groupBy(...columns: string[]): this {
    this.groupByColumns = columns
    return this
  }

  /**
   * Build the SELECT query.
   */
  buildSelect(): QueryResult {
    const parts: string[] = []
    this.values = []
    this.paramCount = 1

    // SELECT
    parts.push(`SELECT ${this.selectColumns.join(', ')}`)

    // FROM
    parts.push(`FROM ${this.table}`)

    // WHERE
    const whereClause = this.buildWhereClause()
    if (whereClause) {
      parts.push(whereClause)
    }

    // GROUP BY
    if (this.groupByColumns.length > 0) {
      parts.push(`GROUP BY ${this.groupByColumns.join(', ')}`)
    }

    // ORDER BY
    if (this.sortColumn) {
      parts.push(`ORDER BY ${this.sortColumn} ${this.sortOrder}`)
    }

    // LIMIT
    if (this.limitValue !== undefined) {
      parts.push(`LIMIT $${this.paramCount++}`)
      this.values.push(this.limitValue)
    }

    // OFFSET
    if (this.offsetValue !== undefined) {
      parts.push(`OFFSET $${this.paramCount++}`)
      this.values.push(this.offsetValue)
    }

    return {
      query: parts.join(' '),
      values: this.values
    }
  }

  /**
   * Build a COUNT query with the same WHERE conditions.
   */
  buildCount(countExpression: string = 'COUNT(*)'): QueryResult {
    const parts: string[] = []
    this.values = []
    this.paramCount = 1

    parts.push(`SELECT ${countExpression} as count`)
    parts.push(`FROM ${this.table}`)

    const whereClause = this.buildWhereClause()
    if (whereClause) {
      parts.push(whereClause)
    }

    return {
      query: parts.join(' '),
      values: this.values
    }
  }

  private buildWhereClause(): string | null {
    if (this.conditions.length === 0) {
      return null
    }

    const clauses = this.conditions.map((cond) => {
      if (cond.operator === 'IN') {
        const values = Array.isArray(cond.value) ? cond.value : [cond.value]
        const placeholders = values.map(() => `$${this.paramCount++}`).join(', ')
        this.values.push(...values)
        return `${cond.column} IN (${placeholders})`
      }

      if (cond.operator === 'ANY') {
        this.values.push(cond.value)
        return `$${this.paramCount++}::text = ANY(${cond.column})`
      }

      this.values.push(cond.value)
      return `${cond.column} ${cond.operator} $${this.paramCount++}`
    })

    return `WHERE ${clauses.join(' AND ')}`
  }

  /**
   * Clone the builder to create variants (e.g., count query).
   */
  clone(): QueryBuilder {
    const cloned = new QueryBuilder({
      table: this.table,
      selectColumns: [...this.selectColumns]
    })
    cloned.conditions = [...this.conditions]
    cloned.sortColumn = this.sortColumn
    cloned.sortOrder = this.sortOrder
    cloned.limitValue = this.limitValue
    cloned.offsetValue = this.offsetValue
    cloned.groupByColumns = [...this.groupByColumns]
    return cloned
  }
}

/**
 * Create a new QueryBuilder instance.
 */
export function createQuery(table: string, selectColumns?: string[]): QueryBuilder {
  return new QueryBuilder({ table, selectColumns })
}
