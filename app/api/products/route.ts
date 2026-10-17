export const runtime = 'nodejs';
export const maxDuration = 60;
import {AppError, requestBody, requireId} from '@/lib/errors';
import {db,owner,failure} from '@/lib/server';import {productSchema} from '@/lib/product';
export async function GET(req:Request){try{const user=await owner(req);const store=new URL(req.url).searchParams.get('store');requireId(store,'store');return Response.json(await db(`products?owner_id=eq.${encodeURIComponent(user)}&store_id=eq.${encodeURIComponent(store||'')}&order=updated_at.desc`));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await owner(req);const {store_id,product}=await requestBody(req);requireId(store_id,'store');const p=productSchema.parse(product);if(p.id)requireId(p.id,'product');const stores=await db(`stores?id=eq.${encodeURIComponent(store_id)}&owner_id=eq.${encodeURIComponent(user)}&select=id`);if(!stores.length)throw new AppError('Store not found',404,'NOT_FOUND');const existing=p.id?await db(`products?id=eq.${encodeURIComponent(p.id)}&owner_id=eq.${encodeURIComponent(user)}&store_id=eq.${encodeURIComponent(store_id)}`):[];if(existing[0]?.publishing_until && new Date(existing[0].publishing_until)>new Date())throw new AppError('Wait for this product to finish uploading before editing',409,'UPLOAD_IN_PROGRESS');const {id,...data}=p;const row={...data,status:'draft',owner_id:user,store_id,updated_at:new Date().toISOString()};return Response.json(existing.length?(await db(`products?id=eq.${encodeURIComponent(id!)}&owner_id=eq.${encodeURIComponent(user)}`,'PATCH',row))[0]:(await db('products','POST',row))[0]);}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{const user=await owner(req);const {id}=await requestBody(req);requireId(id);await db(`products?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(user)}`,'DELETE');return Response.json({ok:true});}catch(e){return failure(e);}}



