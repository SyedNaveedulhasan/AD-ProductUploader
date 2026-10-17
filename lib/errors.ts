import { ZodError } from 'zod';

export class AppError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'INVALID_REQUEST') {
    super(message); this.name = 'AppError'; this.status = status; this.code = code;
  }
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function publicError(error: unknown) {
  if (error instanceof AppError) return { message: error.message, status: error.status, code: error.code };
  if (error instanceof ZodError) return { message: error.issues[0]?.message || 'Check the form fields.', status: 422, code: 'VALIDATION_ERROR' };
  return { message: 'Something went wrong. Please try again. If it continues, share the error reference with support.', status: 500, code: 'INTERNAL_ERROR' };
}

export function failure(error: unknown) {
  const {message, status, code} = publicError(error);
  const requestId = crypto.randomUUID();
  // Never log raw exceptions, request bodies, credentials, or upstream response data.
  if (status >= 500) console.error(JSON.stringify({event:'request_failed', requestId, status, code}));
  return Response.json({error:message, code, requestId}, {status, headers:{'Cache-Control':'no-store', 'X-Request-ID':requestId}});
}

export async function requestBody(req: Request): Promise<Record<string, unknown>> {
  let data: unknown;
  try { data = await req.json(); } catch { throw new AppError('Send a valid JSON request.', 400, 'INVALID_JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('Send a JSON object.', 400, 'INVALID_JSON');
  return data as Record<string, unknown>;
}

export function requireId(value: unknown, label = 'ID'): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)) {
    throw new AppError(`Select a valid ${label}.`, 400, 'INVALID_ID');
  }
}
