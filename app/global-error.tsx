'use client';
export default function GlobalError({error, retry}: {error:Error & {digest?:string}; retry:()=>void}) {
  return <html lang="en"><body style={{margin:0,fontFamily:'Segoe UI, sans-serif',background:'#f8f9f5',color:'#25352e'}}><main style={{maxWidth:560,margin:'15vh auto',padding:24,lineHeight:1.6}}><h1 style={{fontSize:28}}>AD Uploader couldn’t load</h1><p>An unexpected error occurred. Please try again or reload the app.</p>{error.digest&&<p>Reference: {error.digest}</p>}<button style={{padding:'12px 20px',fontSize:16,cursor:'pointer'}} onClick={retry}>Try again</button><a href="/" style={{marginLeft:20,color:'#256348'}}>Reload app</a></main></body></html>;
}
