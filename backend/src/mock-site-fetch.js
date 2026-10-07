import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function publicIPv4(ip) {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
export async function fetchPublicPage(input) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.href.length > 2048) throw new Error('公開HTTPSサイト（443番）だけを指定してください。');
  const hostname = url.hostname;
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !publicIPv4(address))) throw new Error('内部・予約済みIPやIPv6への接続は許可していません。');
  const address = addresses[0].address;
  const html = await new Promise((resolve, reject) => {
    const request = https.get(url, { agent: false, lookup: (_name, _options, callback) => callback(null, address, 4), headers: { 'User-Agent': 'TerminalBox-Training/1.0', Accept: 'text/html', 'Accept-Encoding': 'identity' } }, response => {
      if (response.statusCode !== 200 || !/^text\/html\b/i.test(response.headers['content-type'] ?? '') || !['identity', undefined].includes(response.headers['content-encoding'])) { response.destroy(); reject(new Error('HTMLを取得できません。転送先のURLを直接指定してください。')); return; }
      let size = 0; const chunks = [];
      response.on('data', chunk => { size += chunk.length; if (size > 512000) { response.destroy(new Error('ページが容量上限を超えました。')); } else chunks.push(chunk); });
      response.on('error', reject); response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    const timer = setTimeout(() => request.destroy(new Error('URL取得がタイムアウトしました。')), 10000);
    request.on('error', reject); request.on('close', () => clearTimeout(timer));
  });
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.slice(0,200) ?? '';
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g,' ').slice(0,12000);
  return { url: url.href, title, text };
}
