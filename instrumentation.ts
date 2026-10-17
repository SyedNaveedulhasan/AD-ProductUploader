import type {Instrumentation} from 'next';

export const onRequestError: Instrumentation.onRequestError = (error, _request, context) => {
  // Omit messages, URLs, headers, and request bodies, which can contain credentials.
  const digest = error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' ? error.digest : undefined;
  console.error(JSON.stringify({event:'unhandled_server_error', digest, routeType:context.routeType}));
};
