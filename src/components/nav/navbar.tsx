"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Settings, FileJson } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Events", icon: Calendar },
  { href: "/admin", label: "Admin", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-soft-sage/50 bg-deep-forest">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="gap-2 sr-only text-xl font-bold tracking-tight text-white"
        >
          Hermanus Events Feed
        </Link>

        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-vibrant-leaf/20 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
          <a
            href="/api/schema"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileJson className="h-4 w-4" />
            API
          </a>
        </div>
      </div>
    </nav>
  );
}
