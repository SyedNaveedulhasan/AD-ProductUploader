export const runtime = 'nodejs';
export const maxDuration = 90;
import {AppError, requestBody, requireId} from '@/lib/errors';
import {db,owner,failure,seal,storeURL,woo} from '@/lib/server';
export async function GET(req:Request){try{const user=await owner(req);return Response.json(await db(`stores?owner_id=eq.${encodeURIComponent(user)}&select=id,name,url,currency`));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await owner(req);const {name,url,key,secret}=await requestBody(req);if(typeof url!=='string'||typeof name!=='string'||!name.trim()||typeof key!=='string'||typeof secret!=='string'||!/^ck_[a-f\d]+$/i.test(key)||!/^cs_[a-f\d]+$/i.test(secret))throw new AppError('Enter a store name and valid WooCommerce API keys');const store={owner_id:user,name:String(name).slice(0,100),url:storeURL(url),credentials:await seal({key,secret})};await woo(store,'products?per_page=1');const settings=await woo(store,'settings/general/woocommerce_currency');const [saved]=await db('stores','POST',{...store,currency:settings.value||'USD'});return Response.json({id:saved.id,name:saved.name,url:saved.url,currency:saved.currency});}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{const user=await owner(req);const {id}=await requestBody(req);requireId(id);await db(`stores?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(user)}`,'DELETE');return Response.json({ok:true});}catch(e){return failure(e);}}

