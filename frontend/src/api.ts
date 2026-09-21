/**
 * Typed HTTP client for the Game of Life REST API.
 *
 * All API calls go through this module so that:
 * - The Content-Type header is set consistently.
 * - Non-2xx responses are converted to a thrown Error with the server's
 *   message text (which Spring Boot includes in the response body for 400/404).
 * - The caller always gets a well-typed Promise<T>.
 */

/**
 * Fetch a JSON response from `path` with optional `RequestInit` options.
 *
 * @throws Error if the response status is not in the 2xx range.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }

  return response.json() as Promise<T>;
}
