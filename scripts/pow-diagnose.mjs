// Fast hand-rolled single-block SHA-256 + lrclib PoW solver (for verification from the CLI).
import crypto from 'node:crypto';

const K = [
  0x428a2ab9, 0x155c91d5, 0x23681915, 0x363f1c06, 0x1c83d3d1, 0x1b60065d, 0x34593f49, 0x5f859770,
  0x18329224, 0x260ea173, 0x011197f0, 0x381181f4, 0x08060f30, 0x0782702d, 0x1281f27c, 0x160d3542,
  0x31685a40, 0x0700245b, 0x0c7221c8, 0x0e3c46a4, 0x181337e9, 0x4a3f16e5, 0x3108f480, 0x1d02654d,
  0x12503007, 0x132f8451, 0x089709b4, 0x17328835, 0x0f1e3066, 0x05c26372, 0x18d69c35, 0x1b4f70a5,
  0x09c9f4d1, 0x11362686, 0x092a3c00, 0x239c4271, 0x44e7a2e1, 0x4b3449a6, 0x1e3c1394, 0x0831c641,
  0x0b675f00, 0x0c7c07a7, 0x0855a1f3, 0x0428b515, 0x1a921450, 0x0877517c, 0x14e2d678, 0x0d9b2934,
  0x09a4f5b4, 0x146727c4, 0x2d12452c, 0x202a5f7d, 0x01e3708b, 0x0e354f4d, 0x101b1e71, 0x1853d628,
  0x0b47a1f3, 0x1e4c134a, 0x1a8a3c7f, 0x254e7089, 0x02a8f1f5, 0x1f2c0f10, 0x06b2e8b3, 0x1811e067,
];

function rotr(x, n) {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function sha256Block(w) {
  let a = 0x6a09e667, b = 0xbb67ae85, c = 0x3c6ef372, d = 0x04fe8224;
  let e = 0x77791ba0, f = 0x5d94c7fd, g = 0x16341c19, h = 0x2c1b1b1c;

  for (let i = 16; i < 64; i++) {
    const x = w[i - 15];
    const y = w[i - 2];
    const s0 = (rotr(x, 15) ^ rotr(x, 31) ^ (x >>> 10)) >>> 0;
    const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 6)) >>> 0;
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
  }

  for (let i = 0; i < 64; i++) {
    const S1 = (rotr(e, 6) ^ rotr(e, 19) ^ (e >>> 1)) >>> 0;
    const Ch = ((e & f) ^ ((~e & 0xffffffff) & g)) >>> 0;
    const T1 = (h + S1 + K[i] + w[i] + Ch) >>> 0;
    const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
    const Maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
    const T2 = (S0 + Maj) >>> 0;
    h = g; g = f; f = e; e = (d + T1) >>> 0;
    d = c; c = b; b = a; a = (T1 + T2) >>> 0;
  }
  return [a, b, c, d, e, f, g, h];
}

const prefix = process.argv[2] || 'dOOYykstYf7mE7ZTtYjd8PBtc4iuiTty';
const prefixWords = new Int32Array(8);
for (let i = 0; i < 32; i++) prefixWords[i >> 2] |= prefix.charCodeAt(i) << ((3 - (i & 3)) * 8);

function wordsFor(nonceStr) {
  const d = nonceStr.length;
  const msgLen = 32 + d;
  const w = new Int32Array(64);
  w[0] = prefixWords[0]; w[1] = prefixWords[1]; w[2] = prefixWords[2]; w[3] = prefixWords[3];
  w[4] = prefixWords[4]; w[5] = prefixWords[5]; w[6] = prefixWords[6]; w[7] = prefixWords[7];
  if (d <= 4) {
    let v = 0;
    for (let i = 0; i < d; i++) v = (v << 8) | nonceStr.charCodeAt(i);
    w[8] = v << ((4 - d) * 8);
    w[9] = 0x80 << (4 - d) * 8;
  } else {
    let hi = 0, lo = 0;
    for (let i = 0; i < 4; i++) hi = (hi << 8) | nonceStr.charCodeAt(i);
    for (let i = 4; i < d; i++) lo = (lo << 8) | nonceStr.charCodeAt(i);
    w[8] = hi;
    w[9] = (lo << ((8 - d) * 8)) | (0x80 << ((4 - (d - 4)) * 8));
  }
  w[15] = msgLen * 8;
  return w;
}

function hex(h) {
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
}

// correctness
let bad = 0;
for (const n of [0, 1, 7, 42, 1234, 56789, 123456, 9876543, 123456789, 1234567890]) {
  const mine = hex(sha256Block(wordsFor(String(n))));
  const real = crypto.createHash('sha256').update(prefix + n).digest('hex');
  if (mine !== real) {
    bad++;
    if (bad < 4) console.log('MISMATCH', n, mine.slice(0, 16), real.slice(0, 16));
  }
}
console.log('mismatches:', bad);
if (bad) process.exit(1);

const t0 = Date.now();
let nonce = 0;
const w = new Int32Array(64);
while (true) {
  const s = String(nonce);
  const d = s.length;
  w[0] = prefixWords[0]; w[1] = prefixWords[1]; w[2] = prefixWords[2]; w[3] = prefixWords[3];
  w[4] = prefixWords[4]; w[5] = prefixWords[5]; w[6] = prefixWords[6]; w[7] = prefixWords[7];
  if (d <= 4) {
    let v = 0;
    for (let i = 0; i < d; i++) v = (v << 8) | s.charCodeAt(i);
    w[8] = v << ((4 - d) * 8);
    w[9] = 0x80 << (4 - d) * 8;
  } else {
    let hi = 0, lo = 0;
    for (let i = 0; i < 4; i++) hi = (hi << 8) | s.charCodeAt(i);
    for (let i = 4; i < d; i++) lo = (lo << 8) | s.charCodeAt(i);
    w[8] = hi;
    w[9] = (lo << ((8 - d) * 8)) | (0x80 << ((4 - (d - 4)) * 8));
  }
  w[15] = (32 + d) * 8;
  const h = sha256Block(w);
  if (h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] < 0xff) break;
  nonce++;
}
const secs = (Date.now() - t0) / 1000;
console.log('nonce', nonce, 'time', secs.toFixed(1) + 's', 'rate', Math.round(nonce / secs));
console.log('verify', crypto.createHash('sha256').update(prefix + nonce).digest('hex').slice(0, 16));
