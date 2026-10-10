// 集計と乱数テーブルの検証に使う統計。副作用なし。

/** 平均・標本標準偏差・95%信頼区間の半幅(正規近似)。 */
function summarize(xs) {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1));
  return { mean, sd, half: (1.96 * sd) / Math.sqrt(n) };
}

const faceCounts = (faces) => faces.reduce((c, f) => { c[f - 1]++; return c; }, [0, 0, 0, 0, 0, 0]);

/** 一様分布に対するカイ二乗統計量(自由度5)。 */
function chiSquare(counts) {
  const expected = counts.reduce((a, b) => a + b, 0) / counts.length;
  return counts.reduce((a, c) => a + (c - expected) ** 2 / expected, 0);
}

/** seed固定のサイコロ(mulberry32)。独立な追加標本を再現するためだけに使う。 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return 1 + Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * 6);
  };
}

const makePattern = (roll, normal, fixed) => ({
  normal: Array.from({ length: normal }, roll),
  fixed: Array.from({ length: fixed }, roll),
});

module.exports = { summarize, faceCounts, chiSquare, rng, makePattern };
