import { describe, expect, it } from 'vitest'
import { createQuery, QueryBuilder } from '../../utils/queryBuilder'

describe('parameterized query generation', () => {
  it('keeps hostile values outside SQL and numbers parameters consistently across builds', () => {
    const attack = "x'; DROP TABLE users; --"
    const builder = createQuery('prospects', ['id', 'company_name'])
      .whereEquals('org_id', 'tenant')
      .where('company_name', 'ILIKE', attack)
      .where('state', 'IN', ['CA', 'TX'])
      .where('tags', 'ANY', 'tag')
      .paginate(2, 10)
      .orderBy('id; DROP TABLE users', 'desc', ['id'])
    const selected = builder.buildSelect()
    expect(selected.query).toBe(
      'SELECT id, company_name FROM prospects WHERE org_id = $1 AND company_name ILIKE $2 AND state IN ($3, $4) AND $5::text = ANY(tags) ORDER BY id DESC LIMIT $6 OFFSET $7'
    )
    expect(selected.values).toEqual(['tenant', attack, 'CA', 'TX', 'tag', 10, 10])
    expect(selected.query).not.toContain(attack)
    expect(builder.buildCount()).toEqual({
      query:
        'SELECT COUNT(*) as count FROM prospects WHERE org_id = $1 AND company_name ILIKE $2 AND state IN ($3, $4) AND $5::text = ANY(tags)',
      values: ['tenant', attack, 'CA', 'TX', 'tag']
    })
    expect(builder.buildSelect()).toEqual(selected)
  })
  it('retains zero and false values while omitting absent or conditional filters', () => {
    const result = createQuery('prospects')
      .whereEquals('x', undefined)
      .whereEquals('y', null)
      .whereEquals('score', 0)
      .whereEquals('active', false)
      .whereIf(false, 'bad', '=', 1)
      .whereIf(true, 'missing', '=', undefined)
      .whereIf(true, 'null', '=', null)
      .whereIf(true, 'state', 'IN', 'TX')
      .buildSelect()
    expect(result).toEqual({
      query: 'SELECT * FROM prospects WHERE score = $1 AND active = $2 AND state IN ($3)',
      values: [0, false, 'TX']
    })
  })
  it('keeps cloned query variants independent', () => {
    const original = createQuery('prospects', ['state'])
      .whereEquals('org_id', 'tenant')
      .groupBy('state')
      .limit(5.9)
      .offset(1.9)
      .orderBy('state', 'asc', ['state'])
    const clone = original.clone().whereEquals('state', 'TX')
    expect(original.buildSelect()).toEqual({
      query:
        'SELECT state FROM prospects WHERE org_id = $1 GROUP BY state ORDER BY state ASC LIMIT $2 OFFSET $3',
      values: ['tenant', 5, 1]
    })
    expect(clone.buildSelect().values).toEqual(['tenant', 'TX', 5, 1])
  })
  it('supports unfiltered queries and bounded negative pagination', () => {
    expect(new QueryBuilder({ table: 'prospects' }).buildCount('COUNT(DISTINCT id)')).toEqual({
      query: 'SELECT COUNT(DISTINCT id) as count FROM prospects',
      values: []
    })
    expect(
      createQuery('prospects').limit(-1).offset(-4).orderBy('unknown', 'asc', []).buildSelect()
    ).toEqual({ query: 'SELECT * FROM prospects LIMIT $1 OFFSET $2', values: [0, 0] })
    expect(createQuery('prospects').paginate(-1, 0).buildSelect().values).toEqual([1, 0])
  })
})
