export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.name = 'RequestError'; this.status = status; }
}

export async function requestJSON(url: string, init: RequestInit = {}, timeout = 30000): Promise<any> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  init.signal?.addEventListener('abort', abort, {once:true});
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(url, {...init, signal:controller.signal});
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new RequestError('The server returned an unreadable response. Please try again.', response.status); }
    if (!response.ok) {
      const fallback = response.status === 429 ? 'Too many requests. Wait a moment and try again.' : response.status >= 500 ? 'The service is temporarily unavailable. Please try again.' : 'The request could not be completed.';
      const message = [data?.error, data?.error_description, data?.msg].find(v => typeof v === 'string');
      const reference = typeof data?.requestId === 'string' ? ` (Reference: ${data.requestId})` : '';
      throw new RequestError((message || fallback) + reference, response.status);
    }
    if (data === null) throw new RequestError('The server returned an empty response. Please try again.', response.status);
    return data;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    if (controller.signal.aborted) throw new RequestError('The request timed out or was cancelled. Check its status before retrying an upload.');
    throw new RequestError('Unable to reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer); init.signal?.removeEventListener('abort', abort);
  }
}
