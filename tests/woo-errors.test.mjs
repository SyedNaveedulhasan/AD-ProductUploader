import {test} from 'node:test';
import assert from 'node:assert/strict';
import {wooFailure,existingWooId} from '../lib/woo-errors.ts';

test('Missing remote product clears its stale ID so the normal SKU check and create path can run',async()=>{
  let cleared=0;
  const id=await existingWooId(42,async()=>{throw wooFailure(404,{code:'woocommerce_rest_product_invalid_id'})},async()=>{cleared++});
  assert.equal(id,undefined);assert.equal(cleared,1);
  assert.equal(await existingWooId(43,async()=>({id:43}),async()=>assert.fail('must not clear existing ID')),43);
});

test('Unrelated errors and failed cleanup stop recreation',async()=>{
  for(const status of [401,403,404,429,500]) {
    const error=wooFailure(status,{code:'unrelated',message:'secret raw response'});
    await assert.rejects(existingWooId(42,async()=>{throw error},async()=>assert.fail('must retain ID')),e=>e===error);
  }
  await assert.rejects(existingWooId(42,async()=>{throw wooFailure(404,{code:'woocommerce_rest_product_invalid_id'})},async()=>{throw new Error('database unavailable')}),/database unavailable/);
});

test('WooCommerce errors report safe actionable messages without upstream secrets',()=>{
  const sku=wooFailure(400,{code:'woocommerce_rest_product_invalid_sku',message:'secret'});
  assert.equal(sku.code,'WOO_INVALID_SKU');assert.match(sku.message,/unique/);
  assert.equal(wooFailure(400,{code:'woocommerce_product_image_upload_error'}).code,'WOO_IMAGE_ERROR');
  assert.equal(wooFailure(400,{code:'rest_invalid_param'}).status,422);
  assert.doesNotMatch(wooFailure(500,{message:'secret credentials'}).message,/secret credentials/);
});
