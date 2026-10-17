'use client';
export default function ErrorPage({error, retry}: {error: Error & {digest?:string}; retry:()=>void}) {
  return <main className="recovery-page"><h1>Unable to load your workspace</h1><p>Please try again. If the problem continues, reload the page.</p>{error.digest&&<small>Reference: {error.digest}</small>}<div><button onClick={retry}>Try again</button><a href="/">Reload workspace</a></div></main>;
}
