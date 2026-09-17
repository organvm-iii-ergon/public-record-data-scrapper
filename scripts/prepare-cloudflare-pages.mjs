import { cp, mkdir, readFile, writeFile, realpath, rm } from 'node:fs/promises'
import { resolve, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export async function preparePages(environment, projectName, outputRoot = root) {
  if (!['staging', 'production'].includes(environment))
    throw new Error('Select staging or production explicitly')
  const expected = environment === 'staging' ? 'ucc-mca-dashboard-staging' : 'ucc-mca-dashboard'
  if (![expected, expected + '-ivixivi'].includes(projectName))
    throw new Error('Pages project does not match the selected environment')
  outputRoot = await realpath(outputRoot)
  const source = await realpath(resolve(outputRoot, 'dist'))
  if (relative(outputRoot, source) !== 'dist')
    throw new Error('Build output must be the local dist directory')
  const html = await readFile(resolve(source, 'index.html'), 'utf8')
  if (!html.includes('/assets/') || html.includes('/public-record-data-scrapper/'))
    throw new Error('Build the SPA with base / before preparing Pages')
  const destination = resolve(outputRoot, '.quality/cloudflare-pages', environment)
  const parent = dirname(destination)
  await mkdir(parent, { recursive: true })
  if ((await realpath(parent)) !== parent)
    throw new Error('Pages scratch path must not use symlinks')
  // Rebuild the disposable package so stale chunks cannot survive a later build.
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  // Do not mutate the source build or any production project during preparation.
  await cp(source, resolve(destination, 'dist'), { recursive: true, force: true })
  await mkdir(resolve(destination, 'functions'), { recursive: true })
  await cp(
    resolve(root, 'functions/_middleware.js'),
    resolve(destination, 'functions/_middleware.js')
  )
  await writeFile(
    resolve(destination, 'dist/_routes.json'),
    JSON.stringify(
      { version: 1, include: ['/api', '/api/*', '/v1', '/v1/*'], exclude: [] },
      null,
      2
    ) + '\n'
  )
  const service = environment === 'staging' ? 'ucc-mca-edge-staging' : 'ucc-mca-edge-production'
  const config = {
    name: projectName,
    compatibility_date: '2026-09-16',
    pages_build_output_dir: './dist',
    services: [{ binding: 'API', service }],
    env: { preview: { services: [{ binding: 'API', service }] } }
  }
  await writeFile(resolve(destination, 'wrangler.json'), JSON.stringify(config, null, 2) + '\n')
  return destination
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [environment, projectName] = process.argv.slice(2)
  try {
    console.log(await preparePages(environment, projectName))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
