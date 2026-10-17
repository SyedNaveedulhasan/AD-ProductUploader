export const runtime = 'nodejs';
export const maxDuration = 300;
import {AppError, requestBody, requireId, publicError} from '@/lib/errors';
import {db,owner,failure,woo} from '@/lib/server';
import {productSchema,variationAttributes} from '@/lib/product';
import {existingWooId} from '@/lib/woo-errors';
export async function POST(req:Request){
 try{
  const user=await owner(req);const {id}=await requestBody(req);requireId(id);
  const [p]=await db(`products?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(user)}`);
  if(!p)throw new AppError('Product not found',404,'NOT_FOUND');productSchema.parse(p);
  const [store]=await db(`stores?id=eq.${p.store_id}&owner_id=eq.${encodeURIComponent(user)}`);
  if(!store)throw new AppError('Store not found',404,'NOT_FOUND');
  const claim=await db(`products?id=eq.${p.id}&or=(publishing_until.is.null,publishing_until.lt.${encodeURIComponent(new Date().toISOString())})`,'PATCH',{publishing_until:new Date(Date.now()+3600000).toISOString()});
  if(!claim.length)throw new AppError('This product is already uploading. Try again shortly.',409,'UPLOAD_IN_PROGRESS');
  try{
   if(!p.sku)throw new AppError('Add a unique SKU before uploading');
   const wooId=await existingWooId(p.woo_id, id=>woo(store,`products/${id}`), ()=>db(`products?id=eq.${p.id}`,'PATCH',{woo_id:null}));
   let categories:any[]=[];
   if(p.category){
    const list=await woo(store,`products/categories?search=${encodeURIComponent(p.category)}`);
    let cat=list.find((x:any)=>x.name.toLowerCase()===p.category.toLowerCase());
    if(!cat)cat=await woo(store,'products/categories','POST',{name:p.category});
    categories=[{id:cat.id}];
   }
   const allAttributes=p.variations.flatMap(variationAttributes);
   const attributes=p.type==='variable'?Array.from(new Set<string>(allAttributes.map((a:any)=>a.name))).map(name=>({name,visible:true,variation:true,options:Array.from(new Set(allAttributes.filter((a:any)=>a.name===name).map((a:any)=>a.option)))})):[];
   const payload={name:p.name,type:p.type,status:p.type==='variable'?'draft':'publish',sku:p.sku,regular_price:String(p.price),sale_price:p.sale_price===''?'':String(p.sale_price),manage_stock:p.type==='simple',stock_quantity:p.stock,description:p.description,images:p.image?[{src:p.image}]:[],categories,virtual:p.virtual,downloadable:p.downloadable,downloads:p.downloadable?[{name:p.name,file:p.download_url}]:[],weight:p.weight,dimensions:{length:p.length,width:p.width,height:p.height},product_url:p.external_url,button_text:'Buy product',grouped_products:p.grouped_ids,attributes};
   if(!wooId){const match=await woo(store,`products?sku=${encodeURIComponent(p.sku)}`);if(match.length)throw new AppError('This SKU already exists in WooCommerce. Use a unique SKU to avoid overwriting another product.');}
   const remote=await woo(store,wooId?`products/${wooId}`:'products',wooId?'PUT':'POST',payload);
   // Persist the remote ID before variation writes, allowing safe retries after partial failure.
   await db(`products?id=eq.${p.id}`,'PATCH',{woo_id:remote.id});
   if(p.type==='variable'){
    const existing=await woo(store,`products/${remote.id}/variations?per_page=100`);const retained=new Set<number>();
    for(const v of p.variations){
     const attrs=variationAttributes(v);
     const found=existing.find((x:any)=>x.attributes.length===attrs.length&&attrs.every(a=>x.attributes.some((b:any)=>b.name.toLowerCase()===a.name.toLowerCase()&&b.option===a.option)));
     const saved=await woo(store,`products/${remote.id}/variations${found?'/'+found.id:''}`,found?'PUT':'POST',{regular_price:String(v.price),sku:v.sku,manage_stock:true,stock_quantity:v.stock,attributes:attrs});
     retained.add(saved.id);
    }
    for(const old of existing){if(!retained.has(old.id))await woo(store,`products/${remote.id}/variations/${old.id}?force=true`,'DELETE');}
    await woo(store,`products/${remote.id}`,'PUT',{status:'publish'});
   }
   const [saved]=await db(`products?id=eq.${p.id}`,'PATCH',{status:'publish',error:null,publishing_until:null,updated_at:new Date().toISOString()});
   return Response.json(saved);
  }catch(e){try{await db(`products?id=eq.${p.id}`,'PATCH',{publishing_until:null,error:publicError(e).message});}catch{console.error(JSON.stringify({event:'upload_cleanup_failed',productId:p.id}));}throw e;}
 }catch(e){return failure(e);}
}
