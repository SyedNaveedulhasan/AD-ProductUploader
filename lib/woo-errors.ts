import {AppError} from './errors.ts';

export function wooFailure(status:number, data:unknown) {
  const code=data&&typeof data==='object'&&'code' in data?data.code:undefined;
  if(status===404&&code==='woocommerce_rest_product_invalid_id') return new AppError('This product no longer exists in WooCommerce. Upload it again to recreate it.',404,'WOO_PRODUCT_NOT_FOUND');
  if(status===401||status===403)return new AppError('WooCommerce rejected these credentials. Check the API keys and Read/Write permissions.',502,'STORE_REQUEST_FAILED');
  if(status===429)return new AppError('WooCommerce is busy. Wait a moment before retrying.',502,'STORE_REQUEST_FAILED');
  if(code==='woocommerce_rest_product_invalid_sku'||code==='product_invalid_sku')return new AppError('WooCommerce rejected this SKU. Check that it is unique in your store.',409,'WOO_INVALID_SKU');
  if(code==='woocommerce_product_image_upload_error')return new AppError('WooCommerce could not download the product image. Check its public image URL or upload another image.',422,'WOO_IMAGE_ERROR');
  if(code==='rest_invalid_param')return new AppError('WooCommerce rejected a product field. Check its type, prices, stock, and variations.',422,'WOO_VALIDATION_ERROR');
  if(status===404)return new AppError('The WooCommerce API endpoint was not found. Check your store URL and REST API settings.',502,'WOO_ENDPOINT_NOT_FOUND');
  return new AppError('WooCommerce could not complete this request. Check the product details and store status.',502,'STORE_REQUEST_FAILED');
}

// Only this specific WooCommerce response permits recreation. Other errors must stop the upload.
export async function existingWooId(id:number|undefined, read:(id:number)=>Promise<unknown>, clear:()=>Promise<unknown>) {
  if(!id)return undefined;
  try{await read(id);return id}
  catch(error){
    if(!(error instanceof AppError)||error.code!=='WOO_PRODUCT_NOT_FOUND')throw error;
    await clear();return undefined;
  }
}
