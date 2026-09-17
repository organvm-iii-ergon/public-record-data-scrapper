/** Forward authenticated API traffic through the environment's Worker binding. */
export async function onRequest(context) {
  const { request, env } = context
  const { pathname, origin } = new URL(request.url)
  if (!/^\/(api|v1)(\/|$)/.test(pathname)) return context.next()
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' }
  if (!env.API || typeof env.API.fetch !== 'function') {
    return new Response(
      JSON.stringify({
        error: 'API_UNAVAILABLE',
        message: 'The API service binding is not configured.'
      }),
      { status: 503, headers }
    )
  }
  const source = request.headers.get('origin')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && source && source !== origin) {
    return new Response(JSON.stringify({ error: 'ORIGIN_REJECTED' }), { status: 403, headers })
  }
  try {
    // Preserve the path, query, body and verified Access assertion. The Worker
    // verifies the assertion and owns tenant membership and authorization.
    const upstream = await env.API.fetch(new Request(request, { redirect: 'manual' }))
    const response = new Response(upstream.body, upstream)
    response.headers.set('cache-control', 'no-store')
    return response
  } catch {
    return new Response(
      JSON.stringify({
        error: 'API_UNAVAILABLE',
        message: 'The API service could not be reached. Retry shortly.'
      }),
      { status: 502, headers }
    )
  }
}
