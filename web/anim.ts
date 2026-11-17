/** Hệ thống hoạt ảnh tuần tự đơn giản: mỗi bước là một hàm trả về true khi xong */
export type Step = (dt: number) => boolean;

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeIn = (t: number) => t * t;

export function tween(duration: number, fn: (t: number) => void, opts: { ease?: (t: number) => number; onStart?: () => void } = {}): Step {
  let elapsed = 0;
  let started = false;
  const ease = opts.ease ?? easeInOut;
  return (dt) => {
    if (!started) {
      started = true;
      opts.onStart?.();
    }
    elapsed += dt;
    const t = Math.min(1, elapsed / duration);
    fn(ease(t));
    return t >= 1;
  };
}

export const wait = (d: number): Step => tween(d, () => {});
export const call = (fn: () => void): Step => () => {
  fn();
  return true;
};

export class Animator {
  private readonly queue: Step[][] = [];
  private current: Step[] | null = null;

  /** Thêm một chuỗi hoạt ảnh; các chuỗi chạy lần lượt */
  run(...steps: Step[]): void {
    this.queue.push(steps);
  }

  /** Hủy mọi hoạt ảnh đang chờ và đang chạy */
  clear(): void {
    this.queue.length = 0;
    this.current = null;
  }

  get busy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  update(dt: number): void {
    if (!this.current) this.current = this.queue.shift() ?? null;
    if (!this.current) return;
    if (this.current[0](dt)) this.current.shift();
    if (this.current.length === 0) this.current = null;
  }
}
