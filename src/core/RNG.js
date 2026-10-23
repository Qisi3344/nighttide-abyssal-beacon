/** 确定性伪随机(mulberry32):保证同一种子生成同一片海沟,便于测试与复现。 */
export class RNG {
  constructor(seed = 20261024) {
    this.seed = seed >>> 0;
    this.state = this.seed >>> 0;
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) 浮点 */
  range(min, max) { return min + this.next() * (max - min); }

  /** [min, max] 整数 */
  int(min, max) { return Math.floor(this.range(min, max + 1)); }

  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }

  /** 简单二维值噪声,用于地形高度场 */
  noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const h = (a, b) => {
      let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(this.seed, 2246822519);
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /** 分形叠加噪声 */
  fbm(x, y, octaves = 4) {
    let value = 0, amp = 0.5, freq = 1, total = 0;
    for (let i = 0; i < octaves; i++) {
      value += amp * this.noise2(x * freq, y * freq);
      total += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return value / total;
  }
}
