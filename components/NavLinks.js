'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ items }) {
  const path = usePathname();
  return (
    <ul className="nav-list">
      {items.map((it, i) => {
        const active = i === 0 ? path === it.href : path.startsWith(it.href);
        return (
          <li key={it.href}>
            <Link href={it.href} className={active ? 'active' : undefined}>{it.label}</Link>
          </li>
        );
      })}
    </ul>
  );
}
