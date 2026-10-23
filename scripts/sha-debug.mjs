// Generate the real SHA-256 K constants and diff against the ones used in the hand-rolled impl.
const primes = [];
for (let n = 2; primes.length < 64; n++) {
  let isPrime = true;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) { isPrime = false; break; }
  if (isPrime) primes.push(n);
}
const realK = primes.map((p) => Math.floor((Math.sqrt(p) % 1) * 2 ** 32));

const myK = [
  0x428a2ab9, 0x155c91d5, 0x23681915, 0x363f1c06, 0x1c83d3d1, 0x1b60065d, 0x34593f49, 0x5f859770,
  0x18329224, 0x260ea173, 0x011197f0, 0x381181f4, 0x08060f30, 0x0782702d, 0x1281f27c, 0x160d3542,
  0x31685a40, 0x0700245b, 0x0c7221c8, 0x0e3c46a4, 0x181337e9, 0x4a3f16e5, 0x3108f480, 0x1d02654d,
  0x12503007, 0x132f8451, 0x089709b4, 0x17328835, 0x0f1e3066, 0x05c26372, 0x18d69c35, 0x1b4f70a5,
  0x09c9f4d1, 0x11362686, 0x092a3c00, 0x239c4271, 0x44e7a2e1, 0x4b3449a6, 0x1e3c1394, 0x0831c641,
  0x0b675f00, 0x0c7c07a7, 0x0855a1f3, 0x0428b515, 0x1a921450, 0x0877517c, 0x14e2d678, 0x0d9b2934,
  0x09a4f5b4, 0x146727c4, 0x2d12452c, 0x202a5f7d, 0x01e3708b, 0x0e354f4d, 0x101b1e71, 0x1853d628,
  0x0b47a1f3, 0x1e4c134a, 0x1a8a3c7f, 0x254e7089, 0x02a8f1f5, 0x1f2c0f10, 0x06b2e8b3, 0x1811e067,
];

let diffs = 0;
for (let i = 0; i < 64; i++) {
  if (realK[i] !== myK[i]) {
    diffs++;
    console.log('K[' + i + '] real', realK[i].toString(16), 'mine', myK[i].toString(16));
  }
}
console.log('diffs:', diffs);
