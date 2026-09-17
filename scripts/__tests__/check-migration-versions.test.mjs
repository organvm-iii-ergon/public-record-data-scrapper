import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkMigrations, validateMigrationVersions } from '../check-migration-versions.mjs'

test('checked-in migrations have unique versions in each store', () => {
  checkMigrations()
})

test('duplicate versions and differently padded aliases fail before migration', () => {
  for (const files of [
    ['027_billing.sql', '027_referrals.sql'],
    ['0004_jobs.sql', '4_metering.sql']
  ]) {
    assert.throws(() => validateMigrationVersions(files), /Duplicate migration version/)
  }
})

test('rollback companions do not collide and malformed forward migrations fail', () => {
  assert.equal(validateMigrationVersions(['027_billing.sql', '027_down.sql']).size, 1)
  assert.throws(() => validateMigrationVersions(['billing.sql']), /Invalid migration filename/)
})
