const API_BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api').replace(/\/$/, '')

export class ApiError extends Error {
  public readonly status: number
  public readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: RequestInit['body'] | Record<string, unknown>
}

function resolveUrl(path: string): string {
  if (/^https?:/i.test(path)) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body: rawBody, headers: rawHeaders, ...rest } = options
  const headers = new Headers(rawHeaders ?? {})
  headers.set('Accept', 'application/json')

  let body: BodyInit | null | undefined = rawBody as BodyInit | null | undefined

  if (body && typeof body !== 'string' && !(body instanceof FormData)) {
    body = JSON.stringify(body)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
  }

  try {
    const response = await fetch(resolveUrl(path), {
      ...rest,
      headers,
      body
    })

    const contentType = response.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')
    let responseBody: unknown = null

    if (response.status !== 204) {
      if (isJson) {
        responseBody = await response.json()
      } else {
        const text = await response.text()
        responseBody = text.length > 0 ? text : null
      }
    }

    if (!response.ok) {
      const message =
        typeof responseBody === 'object' && responseBody !== null && 'message' in responseBody
          ? String((responseBody as { message: unknown }).message)
          : response.statusText || 'Request failed'
      throw new ApiError(message, response.status, responseBody)
    }

    return responseBody as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Network request failed',
      0,
      null
    )
  }
}
