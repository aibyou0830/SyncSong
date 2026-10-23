// Solve an lrclib PoW challenge and print the publish token.
import crypto from 'node:crypto';

const target = Buffer.from('000000FF00000000000000000000000000000000000000000000000000000000', 'hex');

function solve(prefix) {
  let nonce = 0;
  while (true) {
    const h = crypto.createHash('sha256').update(prefix + nonce).digest();
    if (h.compare(target) < 0) return nonce;
    nonce++;
  }
}

const response = await fetch('https://lrclib.net/api/request-challenge', {
  method: 'POST',
  headers: { 'User-Agent': 'SyncSong v1.0 (https://syncsong.net)' },
});
const { prefix, target: targetHex } = await response.json();
console.log('challenge', prefix, targetHex.slice(0, 8));
const t0 = Date.now();
const nonce = solve(prefix);
console.log('token', `${prefix}:${nonce}`, 'in', (Date.now() - t0) / 1000, 's');
