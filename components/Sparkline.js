export default function Sparkline({ data, className = 'spark', height = 34, width = 120, stroke }) {
  const pts = (data || []).filter((v) => v != null);
  if (pts.length < 2) return <svg className={className} viewBox={`0 0 ${width} ${height}`} />;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join('');
  const up = pts[pts.length - 1] >= pts[0];
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={stroke || (up ? 'var(--up)' : 'var(--down)')} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
