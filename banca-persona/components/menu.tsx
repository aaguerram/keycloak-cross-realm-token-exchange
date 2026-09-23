'use client';
// Menú principal: resalta la opción de la ruta actual
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'General' },
  { href: '/consulta', label: 'Consulta' },
];

export function Menu() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <nav className="menu">
      {ITEMS.map(({ href, label }) => (
        <Link key={href} href={href} className={isActive(href) ? 'active' : undefined} aria-current={isActive(href) ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
