export type Affine = { s: number; theta: number; tx: number; ty: number; flipY?: boolean };

export function worldToCanvas(point: [number, number], a: Affine): [number, number] {
  const [x, y] = point;
  const c = Math.cos(a.theta), s = Math.sin(a.theta);
  const xr = x * c - y * s;
  const yr = x * s + y * c;
  const X = a.s * xr + a.tx;
  const Yraw = a.s * yr + a.ty;
  return [X, a.flipY ? -Yraw : Yraw];
}

export function canvasToWorld(point: [number, number], a: Affine): [number, number] {
  const [X, Y] = point;
  const Yraw = a.flipY ? -Y : Y;
  const xr = (X - a.tx) / a.s;
  const yr = (Yraw - a.ty) / a.s;
  const c = Math.cos(a.theta), s = Math.sin(a.theta);
  const x = xr * c + yr * s;
  const y = -xr * s + yr * c;
  return [x, y];
}

export function transformRingToCanvas(ring: [number, number][], a: Affine): number[] {
  const pts: number[] = [];
  for (const p of ring) {
    const [X, Y] = worldToCanvas(p, a);
    pts.push(X, Y);
  }
  return pts;
}


