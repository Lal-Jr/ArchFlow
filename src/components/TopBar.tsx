import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/" className="text-lg font-bold tracking-tight">
      ArchFlow
    </Link>
  );
}

/** The black app bar used on every screen. */
export function TopBar({ children, right }: { children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-5 bg-ink px-5 text-white">
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
      className={`rounded-full px-3 py-1.5 text-sm font-medium ${active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}
