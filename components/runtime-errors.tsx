'use client';
import {useEffect} from 'react';
import {toast, Toaster} from 'sonner';

export default function RuntimeErrors() {
  useEffect(() => {
    const unexpected = () => toast.error('An unexpected error occurred. Reload the page if it continues.', {id:'unexpected-error', action:{label:'Reload', onClick:()=>window.location.reload()}});
    const offline = () => toast.error('You are offline. Reconnect before saving or uploading.', {id:'connection'});
    const online = () => toast.success('Connection restored.', {id:'connection'});
    const onError = (event: ErrorEvent) => { if (event.error) unexpected(); };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', unexpected);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', unexpected);
      window.removeEventListener('offline', offline); window.removeEventListener('online', online);
    };
  }, []);
  return <Toaster position="bottom-right" richColors/>;
}
