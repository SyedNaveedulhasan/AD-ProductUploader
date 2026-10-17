import {requestJSON, RequestError} from './client-request.ts';

type Session = {access_token:string; refresh_token?:string; expires_at:number};
type Storage = Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'>;
const sessionKey='storelift-session', legacyKey='storelift-token';

function expiry(token:string) {
  try {return Number(JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).exp)||0;}
  catch {return 0;}
}

export class BrowserSession {
  private session:Session|null=null;
  private refresh:Promise<string>|null=null;
  private version=0;
  private url:string; private anonKey:string; private storage?:Storage;
  constructor(url:string, anonKey:string, storage?:Storage) {this.url=url;this.anonKey=anonKey;this.storage=storage;}

  restore() {
    try {
      const data=JSON.parse(this.storage?.getItem(sessionKey)||'null');
      if(typeof data?.access_token==='string'&&data.access_token) {
        this.session={access_token:data.access_token, refresh_token:typeof data.refresh_token==='string'?data.refresh_token:undefined, expires_at:expiry(data.access_token)||Number(data.expires_at)||0};
      } else {
        const token=this.storage?.getItem(legacyKey);
        if(token)this.session={access_token:token,expires_at:expiry(token)};
      }
    } catch {this.session=null;}
    return this.session?.access_token||'';
  }

  set(data:{access_token?:unknown; refresh_token?:unknown; expires_at?:unknown; expires_in?:unknown}) {
    if(typeof data.access_token!=='string'||!data.access_token)throw new RequestError('Sign-in did not return a valid session. Please try again.',401);
    this.version++;
    this.session={access_token:data.access_token,refresh_token:typeof data.refresh_token==='string'?data.refresh_token:undefined,expires_at:expiry(data.access_token)||Number(data.expires_at)||(Number(data.expires_in)?Date.now()/1000+Number(data.expires_in):0)};
    try {this.storage?.setItem(sessionKey,JSON.stringify(this.session));this.storage?.removeItem(legacyKey);}catch{/* Keep the current session usable when storage is blocked. */}
  }

  clear() {
    this.version++;this.session=null;this.refresh=null;
    try {this.storage?.removeItem(sessionKey);this.storage?.removeItem(legacyKey);}catch{}
  }

  async accessToken():Promise<string> {
    if(!this.session)throw new RequestError('Sign in to continue.',401);
    if(!this.session.expires_at||this.session.expires_at>Date.now()/1000+60)return this.session.access_token;
    if(this.refresh)return this.refresh;
    if(!this.session.refresh_token){this.clear();throw new RequestError('Your session expired. Sign in again.',401);}
    const version=this.version;
    const task=(async()=>{
      try {
        const data=await requestJSON(`${this.url}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:this.anonKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:this.session!.refresh_token})});
        if(this.version!==version)throw new RequestError('Your session changed. Sign in again.',401);
        this.set(data);return this.session!.access_token;
      } catch(error) {
        if(error instanceof RequestError&&[400,401,403].includes(error.status)) {
          if(this.version===version)this.clear();
          throw new RequestError('Your session expired. Sign in again.',401);
        }
        throw error;
      }
    })();
    this.refresh=task;
    try{return await task;}finally{if(this.refresh===task)this.refresh=null;}
  }
}
