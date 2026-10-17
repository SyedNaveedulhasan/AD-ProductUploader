import { wooRequest } from './woo-http';
export { storeURL } from './woo-http';
import { AppError } from './errors';
export { failure } from './errors';
import { getChatGPTUser } from '@/app/chatgpt-auth';

export function configured() {
  try {
    const url = new URL(process.env.SUPABASE_URL || '');
    return url.protocol === 'https:' && !url.hostname.includes('your_project') &&
      !!process.env.SUPABASE_ANON_KEY && !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
      /^[a-f\d]{64}$/i.test(process.env.CREDENTIAL_ENCRYPTION_KEY || '');
  } catch { return false; }
}

export async function serviceFetch(url: string, init: RequestInit) {
  try { return await fetch(url, {...init, signal:AbortSignal.timeout(25000)}); }
  catch { throw new AppError('The database service is unavailable. Please try again shortly.', 503, 'SERVICE_UNAVAILABLE'); }
}
async function serviceJSON(response: Response): Promise<any> {
  try { return await response.json(); }
  catch { throw new AppError('The database service returned an unreadable response. Please try again.', 502, 'INVALID_SERVICE_RESPONSE'); }
}
export async function owner(req: Request) {
  if (!configured()) throw new AppError('App setup is incomplete. Ask the administrator to check the Supabase settings.', 503, 'SETUP_REQUIRED');
  if (process.env.SITES_USE_IDENTITY === 'true') { const user = await getChatGPTUser(); if (user) return user.userId; }
  const token = req.headers.get('authorization');
  if (!token?.startsWith('Bearer ')) throw new AppError('Sign in to continue.', 401, 'AUTH_REQUIRED');
  const response = await serviceFetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization:token}});
  if (response.status >= 500 || response.status === 429) throw new AppError('Sign-in service is temporarily unavailable. Try again shortly.', 503, 'AUTH_UNAVAILABLE');
  if (!response.ok) throw new AppError('Your session expired. Sign in again.', 401, 'AUTH_REQUIRED');
  const data = await serviceJSON(response);
  if (typeof data?.id !== 'string') throw new AppError('Unable to verify your account. Sign in again.', 401, 'AUTH_REQUIRED');
  return data.id as string;
}
export async function db(path: string, method = 'GET', body?: unknown): Promise<any> {
  const response = await serviceFetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method, headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type':'application/json', Prefer:'return=representation'},
    body:body === undefined ? undefined : JSON.stringify(body), cache:'no-store',
  });
  if (!response.ok) {
    const data: any = await response.json().catch(() => null);
    if (data?.code === '23505') throw new AppError('This store or SKU already exists. Use a unique value.', 409, 'DUPLICATE_RECORD');
    if (data?.code === '23503') throw new AppError('The store or product no longer exists. Reload your workspace.', 409, 'RECORD_CHANGED');
    throw new AppError('Unable to access saved data. Please try again. If it continues, ask the administrator to check database setup.', 503, 'DATABASE_ERROR');
  }
  return response.status === 204 ? [] : serviceJSON(response);
}
async function key() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY || '';
  if (!/^[a-f\d]{64}$/i.test(raw)) throw new AppError('Store encryption is not configured. Contact the administrator.', 503, 'SETUP_REQUIRED');
  return crypto.subtle.importKey('raw', Uint8Array.from(raw.match(/../g)!, v=>parseInt(v,16)), {name:'AES-GCM'}, false, ['encrypt','decrypt']);
}
export async function seal(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv}, await key(), new TextEncoder().encode(JSON.stringify(value)));
  return btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
}
export async function unseal(value: string) {
  const encryptionKey = await key();
  try {
    const [a,b] = value.split('.');
    const data = await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(a),c=>c.charCodeAt(0))}, encryptionKey, Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
    return JSON.parse(new TextDecoder().decode(data));
  } catch { throw new AppError('Unable to read saved store credentials. Reconnect the store or ask the administrator to restore its encryption key.', 503, 'STORE_CREDENTIALS_ERROR'); }
}
export async function woo(store:any, path:string, method='GET', body?:unknown):Promise<any> {
  const creds = await unseal(store.credentials);
  return wooRequest(store.url, path, `Basic ${btoa(creds.key+':'+creds.secret)}`, method, body);
}
