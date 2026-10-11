import Link from "next/link";

/** The ArchFlow mark: two components and the request that flows between them. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" className="fill-accent" />
      <rect x="4.5" y="7" width="5" height="10" rx="1.5" fill="#fff" />
      <rect x="14.5" y="7" width="5" height="10" rx="1.5" fill="#fff" fillOpacity="0.55" />
      <path d="M9.5 12h4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.6" fill="#fff" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <Mark />
      ArchFlow
    </Link>
  );
}

/** The app bar used on every screen. */
export function TopBar({ children, right }: { children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-5 border-b border-line bg-white px-5 text-ink">
      <Wordmark />
      {children}
      <div className="ml-auto flex items-center gap-2">{right}</div>
    </header>
  );
}

export function NavLink({ href, children, active }: { href: string; children: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-accent-wash text-accent-ink" : "text-ink-2 hover:bg-wash hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
