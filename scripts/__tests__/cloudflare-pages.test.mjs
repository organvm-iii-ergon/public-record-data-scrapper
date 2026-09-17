import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { onRequest } from '../../functions/_middleware.js'
import { preparePages } from '../prepare-cloudflare-pages.mjs'

test('Pages forwards API bodies, query and authentication without following redirects', async () => {
  let observed
  const request = new Request('https://staging.pages.dev/api/deals?stage=new', {
    method: 'POST',
    headers: { origin: 'https://staging.pages.dev', 'Cf-Access-Jwt-Assertion': 'test-assertion' },
    body: 'request-body'
  })
  const response = await onRequest({
    request,
    env: {
      API: {
        fetch: async (value) => {
          observed = value
          return new Response('persisted', { status: 201, headers: { 'cache-control': 'public' } })
        }
      }
    }
  })
  assert.equal(observed.url, request.url)
  assert.equal(observed.method, 'POST')
  assert.equal(observed.redirect, 'manual')
  assert.equal(observed.headers.get('Cf-Access-Jwt-Assertion'), 'test-assertion')
  assert.equal(await observed.text(), 'request-body')
  assert.equal(response.status, 201)
  assert.equal(await response.text(), 'persisted')
  assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('Pages preserves authorization failure and v1 routes', async () => {
  const response = await onRequest({
    request: new Request('https://app.pages.dev/v1/prospects'),
    env: { API: { fetch: async () => new Response('unauthorized', { status: 401 }) } }
  })
  assert.equal(response.status, 401)
  assert.equal(await response.text(), 'unauthorized')
})

test('missing bindings and upstream failures produce explicit errors without sample records', async () => {
  const request = new Request('https://app.pages.dev/api/prospects')
  assert.equal((await onRequest({ request, env: {} })).status, 503)
  const response = await onRequest({
    request,
    env: {
      API: {
        fetch: async () => {
          throw new Error('private internal detail')
        }
      }
    }
  })
  assert.equal(response.status, 502)
  assert.equal((await response.text()).includes('private internal detail'), false)
})

test('cross-origin browser writes fail before reaching the API; static requests pass through', async () => {
  const response = await onRequest({
    request: new Request('https://app.pages.dev/api/deals', {
      method: 'POST',
      headers: { origin: 'https://foreign.example' }
    }),
    env: {
      API: {
        fetch: () => {
          throw new Error('must not run')
        }
      }
    }
  })
  assert.equal(response.status, 403)
  const staticResponse = new Response('SPA')
  assert.equal(
    await onRequest({
      request: new Request('https://app.pages.dev/dashboard'),
      env: {},
      next: () => staticResponse
    }),
    staticResponse
  )
})

test('Pages packages separate bindings, API-only routing and replace stale output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ucc-pages-'))
  try {
    await mkdir(join(root, 'dist'))
    await writeFile(join(root, 'dist/index.html'), '<script src="/assets/app.js"></script>')
    for (const [environment, name, service] of [
      ['staging', 'ucc-mca-dashboard-staging', 'ucc-mca-edge-staging'],
      ['production', 'ucc-mca-dashboard', 'ucc-mca-edge-production']
    ]) {
      const destination = await preparePages(environment, name, root)
      const config = JSON.parse(await readFile(join(destination, 'wrangler.json'), 'utf8'))
      assert.equal('account_id' in config, false)
      assert.equal(config.services[0].service, service)
      assert.deepEqual(config.env.preview.services, config.services)
      const routes = JSON.parse(await readFile(join(destination, 'dist/_routes.json'), 'utf8'))
      assert.deepEqual(routes.include, ['/api', '/api/*', '/v1', '/v1/*'])
      await writeFile(join(destination, 'dist/stale.js'), 'old')
      await preparePages(environment, name, root)
      await assert.rejects(readFile(join(destination, 'dist/stale.js')))
    }
    await assert.rejects(preparePages('staging', 'ucc-mca-dashboard', root))
    await assert.rejects(preparePages('other', 'ucc-mca-dashboard', root))
    await writeFile(
      join(root, 'dist/index.html'),
      '<script src="/public-record-data-scrapper/assets/app.js"></script>'
    )
    await assert.rejects(preparePages('staging', 'ucc-mca-dashboard-staging', root))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('deployment workflow targets Cloudflare Pages with exact-revision receipts', async () => {
  const workflow = await readFile(join(process.cwd(), '.github/workflows/deploy-pages.yml'), 'utf8')
  assert.match(workflow, /wrangler pages deploy dist/)
  assert.match(workflow, /ucc-mca-dashboard-staging/)
  assert.match(workflow, /ucc-mca-dashboard/)
  assert.match(workflow, /--commit-hash "\$GITHUB_SHA"/)
  assert.match(workflow, /deployment_trigger\.metadata\.commit_hash/)
  assert.match(workflow, /test "\$GITHUB_REF" = refs\/heads\/main/)
  assert.match(workflow, /max_by\(\.created_on\)/)
  assert.match(workflow, /Resolve or create the exact Pages project/)
  assert.match(workflow, /production_branch:\"main\"/)
  assert.match(workflow, /\.result\.name == \$project/)
  assert.equal(
    (workflow.match(/CLOUDFLARE_ACCOUNT_ID: e0921b840fd656d8ea46426f1f114c30/g) || []).length,
    3
  )
  assert.match(workflow, /test "\$CONFIRM" = DEPLOY/)
  assert.doesNotMatch(workflow, /actions\/deploy-pages/)
  assert.doesNotMatch(workflow, /VITE_PUBLIC_DEMO/)
})
