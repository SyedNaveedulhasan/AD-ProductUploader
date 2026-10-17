import {test, mock} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {AppError, publicError, failure, requestBody, requireId} from '../lib/errors.ts';
import {requestJSON, RequestError} from '../lib/client-request.ts';

test('Expected errors keep status codes; unexpected exceptions do not leak details', async () => {
  assert.deepEqual(publicError(new AppError('Sign in again.',401,'AUTH_REQUIRED')), {message:'Sign in again.',status:401,code:'AUTH_REQUIRED'});
  const log = mock.method(console,'error',()=>{});
  try {
    const response = failure(new Error('secret key abc123 and database SQL'));
    assert.equal(response.status,500);
    const body = await response.json();
    assert.equal(body.code,'INTERNAL_ERROR');
    assert.equal(body.requestId,response.headers.get('X-Request-ID'));
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.doesNotMatch(JSON.stringify(body),/abc123|database SQL/);
    assert.doesNotMatch(JSON.stringify(log.mock.calls),/abc123|database SQL/);
    assert.match(JSON.stringify(log.mock.calls),new RegExp(body.requestId));
  } finally { log.mock.restore(); }
  const validation = z.object({name:z.string().min(1,'Enter a product name.')}).safeParse({name:''});
  assert.equal(publicError(validation.error).status,422);
  assert.equal(publicError(validation.error).message,'Enter a product name.');
});

test('Invalid JSON, body shapes, and IDs return actionable client errors', async () => {
  for(const body of ['{','null','[]','"text"']) {
    await assert.rejects(requestBody(new Request('https://app.local',{method:'POST',body})),e=>e instanceof AppError&&e.status===400);
  }
  assert.deepEqual(await requestBody(new Request('https://app.local',{method:'POST',body:'{"name":"Store"}'})),{name:'Store'});
  for(const id of [null,undefined,'eq.secret',''])assert.throws(()=>requireId(id),AppError);
  assert.doesNotThrow(()=>requireId('69b8c872-19c5-469b-8018-8e67bb5dd5bd'));
});

test('Client handles auth failures, references, rate limits, and unreadable responses', async () => {
  let response;
  const fetchMock=mock.method(globalThis,'fetch',async()=>response);
  try {
    response=Response.json({error:'Sign in again.',requestId:'ref-1'},{status:401});
    await assert.rejects(requestJSON('/api/stores'),e=>e instanceof RequestError&&e.status===401&&e.message.includes('ref-1'));
    response=Response.json({},{status:429});
    await assert.rejects(requestJSON('/api/stores'),/Too many requests/);
    response=new Response('<html>proxy failure</html>',{status:502});
    await assert.rejects(requestJSON('/api/stores'),/unreadable response/);
    response=new Response(null,{status:204});
    await assert.rejects(requestJSON('/api/stores'),/empty response/);
    response=Response.json([{id:1}]);
    assert.deepEqual(await requestJSON('/api/stores'),[{id:1}]);
  } finally {fetchMock.mock.restore();}
});

test('Network and timeout failures are handled without retrying writes',async()=>{
  const fetchMock=mock.method(globalThis,'fetch',async()=>{throw new TypeError('fetch failed with secret details');});
  try{
    await assert.rejects(requestJSON('/api/products',{method:'POST',body:'{}'}),/Check your connection/);
    assert.equal(fetchMock.mock.callCount(),1);
    fetchMock.mock.mockImplementation((_url,{signal})=>new Promise((resolve,reject)=>{
      if(signal.aborted)reject(new Error('Aborted'));
      else signal.addEventListener('abort',()=>reject(new Error('Aborted')),{once:true});
    }));
    await assert.rejects(requestJSON('/api/publish',{method:'POST'},5),/Check its status before retrying/);
    assert.equal(fetchMock.mock.callCount(),2);
    const controller=new AbortController();controller.abort();
    await assert.rejects(requestJSON('/api/stores',{signal:controller.signal}),/cancelled/);
  }finally{fetchMock.mock.restore();}
});
