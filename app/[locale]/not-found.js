import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty">
      404 — <Link href="/" style={{ textDecoration: 'underline' }}>PLAIN.</Link>
    </div>
  );
}
