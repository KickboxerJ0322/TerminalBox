import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function publicIPv4(ip) {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
export async function fetchPublicPage(input, { resolve = lookup, get = https.get } = {}, redirects = 0) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.href.length > 2048) throw new Error('公開HTTPSサイト（443番）だけを指定してください。');
  const hostname = url.hostname;
  const addresses = await resolve(hostname, { all: true, verbatim: true });
  const ipv4 = addresses.filter(({ address }) => isIP(address) === 4);
  if (ipv4.some(({ address }) => !publicIPv4(address))) throw new Error('内部・予約済みIPへの接続は許可していません。');
  if (!ipv4.length) throw new Error('接続できる公開IPv4がありません。IPv6のみのサイトには対応していません。');
  const address = ipv4[0].address;
  const html = await new Promise((resolve, reject) => {
    const request = get(url, { agent: false, family: 4, lookup: (_name, options, callback) => options.all ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4), headers: { 'User-Agent': 'TerminalBox-Training/1.0', Accept: 'text/html', 'Accept-Encoding': 'identity' } }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.destroy();
        if (redirects >= 3) reject(new Error('転送回数が上限を超えました。最終ページのURLを指定してください。'));
        else resolve({ redirect: new URL(response.headers.location, url).href });
        return;
      }
      if (response.statusCode !== 200 || !/^text\/html\b/i.test(response.headers['content-type'] ?? '') || !['identity', undefined].includes(response.headers['content-encoding'])) { response.destroy(); reject(new Error('HTMLを取得できません。転送先のURLを直接指定してください。')); return; }
      let size = 0; let complete = false; const chunks = [];
      const finish = () => { if (complete) return; complete = true; resolve(Buffer.concat(chunks).toString('utf8')); };
      response.on('data', chunk => {
        if (complete) return;
        const remaining = 512000 - size;
        chunks.push(chunk.subarray(0, remaining)); size += Math.min(chunk.length, remaining);
        if (size >= 512000) { finish(); response.destroy(); request.destroy(); }
      });
      response.on('error', error => { if (!complete) reject(error); }); response.on('end', finish);
    });
    const timer = setTimeout(() => request.destroy(new Error('URL取得がタイムアウトしました。')), 10000);
    request.on('error', reject); request.on('close', () => clearTimeout(timer));
  });
  if (typeof html !== 'string') return fetchPublicPage(html.redirect, { resolve, get }, redirects + 1);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.slice(0,200) ?? '';
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g,' ').slice(0,12000);
  return { url: url.href, title, text };
}
