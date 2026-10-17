export const runtime = 'nodejs';
export const maxDuration = 30;
import { configured, failure } from '@/lib/server';
export async function GET(){try{return Response.json({configured:configured(),sitesIdentity:process.env.SITES_USE_IDENTITY==='true',supabaseUrl:process.env.SUPABASE_URL||'',anonKey:process.env.SUPABASE_ANON_KEY||''},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
