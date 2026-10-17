import {AppError} from './errors.ts';
import {wooFailure} from './woo-errors.ts';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16],
  ['192.88.99.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
] as const) blocked.addSubnet(address, prefix, 'ipv6');

export function publicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, 'ipv4');
  return family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

export function storeURL(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new AppError('Enter a valid HTTPS store URL.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.') ||
      /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example|onion)\.?$/.test(host)) {
    throw new AppError('Use a public HTTPS store domain without a custom port or login details.');
  }
  url.search = ''; url.hash = '';
  return url.href.replace(/\/+$/, '');
}

export function approvedAddresses(addresses: { address: string; family: number }[]) {
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) {
    throw new AppError('The store domain must resolve only to public internet addresses.');
  }
  return addresses;
}

export async function wooRequest(base: string, path: string, authorization: string, method = 'GET', body?: unknown) {
  const url = new URL(`${storeURL(base)}/wp-json/wc/v3/${path}`);
  const signal = AbortSignal.timeout(25000);
  const addresses = approvedAddresses(await new Promise<{address: string; family: number}[]>((resolve, reject) => {
    const abort = () => reject(new AppError('Store connection timed out.'));
    signal.addEventListener('abort', abort, { once: true });
    lookup(url.hostname, { all: true }).then(resolve, () => reject(new AppError('Unable to resolve the store domain.')))
      .finally(() => signal.removeEventListener('abort', abort));
  }));
  return new Promise<unknown>((resolve, reject) => {
    // Pin the approved DNS result to the socket; do not resolve it again or reuse a pooled connection.
    const req = request(url, {
      method, agent: false, signal,
      lookup: (_host, options, callback) => {
        const selected = addresses[0];
        if (options.all) callback(null, [selected]);
        else callback(null, selected.address, selected.family);
      },
      headers: { Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json' },
    }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
        res.resume(); reject(new AppError('The store redirected the request. Enter its final HTTPS URL.')); return;
      }
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) { res.destroy(new AppError('Store response is too large.')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { reject(new AppError('The store did not return WooCommerce API data. Check its URL and REST API access.')); return; }
        if (!res.statusCode || res.statusCode >= 400) {
          reject(wooFailure(res.statusCode||502,data)); return;
        }
        resolve(data);
      });
    });
    req.on('error', () => reject(new AppError('Unable to connect securely to the store. Check its HTTPS URL and try again.',502,'STORE_UNAVAILABLE')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
