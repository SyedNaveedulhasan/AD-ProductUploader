import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {BrowserSession} from '../lib/browser-session.ts';
const jwt=exp=>`e30.${Buffer.from(JSON.stringify({exp})).toString('base64url')}.test`;
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};

test('Sign-in immediately supplies the current token and restores the complete session',async()=>{
  const store=storage(),session=new BrowserSession('https://project.supabase.co','anon',store);
  const token=jwt(Date.now()/1000+3600);
  session.set({access_token:token,refresh_token:'refresh-1'});
  assert.equal(await session.accessToken(),token);
  const restored=new BrowserSession('https://project.supabase.co','anon',store);
  assert.equal(restored.restore(),token);
  assert.equal(await restored.accessToken(),token);
  session.clear();assert.equal(store.getItem('storelift-session'),null);
  await assert.rejects(session.accessToken(),e=>e.status===401);
});

test('Concurrent requests refresh once and use the rotated token immediately',async()=>{
  const store=storage(),session=new BrowserSession('https://project.supabase.co','anon',store);
  session.set({access_token:jwt(Date.now()/1000-10),refresh_token:'old-refresh'});
  const token=jwt(Date.now()/1000+3600);
  const fetchMock=mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://project.supabase.co/auth/v1/token?grant_type=refresh_token');
    assert.equal(JSON.parse(options.body).refresh_token,'old-refresh');
    return Response.json({access_token:token,refresh_token:'new-refresh'});
  });
  try{
    assert.deepEqual(await Promise.all([session.accessToken(),session.accessToken()]),[token,token]);
    assert.equal(fetchMock.mock.callCount(),1);
    assert.equal(JSON.parse(store.getItem('storelift-session')).refresh_token,'new-refresh');
    assert.equal(await session.accessToken(),token);assert.equal(fetchMock.mock.callCount(),1);
  }finally{fetchMock.mock.restore()}
});

test('Invalid refresh clears session; temporary network failures preserve it',async()=>{
  const store=storage(),session=new BrowserSession('https://project.supabase.co','anon',store);
  const expired={access_token:jwt(Date.now()/1000-1),refresh_token:'refresh'};
  session.set(expired);
  const fetchMock=mock.method(globalThis,'fetch',async()=>{throw new TypeError('offline')});
  try{
    await assert.rejects(session.accessToken(),/connection/);
    assert.ok(store.getItem('storelift-session'));
    fetchMock.mock.mockImplementation(async()=>Response.json({error:'invalid refresh token'},{status:400}));
    await assert.rejects(session.accessToken(),e=>e.status===401);
    assert.equal(store.getItem('storelift-session'),null);
  }finally{fetchMock.mock.restore()}
});

test('Sign-out during refresh cannot restore the signed-out session',async()=>{
  const store=storage(),session=new BrowserSession('https://project.supabase.co','anon',store);
  session.set({access_token:jwt(Date.now()/1000-1),refresh_token:'refresh'});
  let finish;
  const fetchMock=mock.method(globalThis,'fetch',()=>new Promise(resolve=>{finish=resolve}));
  try{
    const pending=session.accessToken();session.clear();
    finish(Response.json({access_token:jwt(Date.now()/1000+3600),refresh_token:'rotated'}));
    await assert.rejects(pending,e=>e.status===401);
    assert.equal(store.getItem('storelift-session'),null);
    await assert.rejects(session.accessToken(),e=>e.status===401);
  }finally{fetchMock.mock.restore()}
});

test('Legacy expired sessions request sign-in; blocked storage still allows this session',async()=>{
  const store=storage();store.setItem('storelift-token',jwt(Date.now()/1000-1));
  const legacy=new BrowserSession('https://project.supabase.co','anon',store);legacy.restore();
  await assert.rejects(legacy.accessToken(),e=>e.status===401);
  const blocked={getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')},removeItem(){throw new Error('blocked')}};
  const session=new BrowserSession('https://project.supabase.co','anon',blocked);
  assert.equal(session.restore(),'');const token=jwt(Date.now()/1000+3600);
  session.set({access_token:token,refresh_token:'refresh'});assert.equal(await session.accessToken(),token);
});
