"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/test-page-1", label: "Test Page 1" },
    { href: "/test-page-2", label: "Test Page 2" },
  ];

  return (
    <nav className="mb-6 p-4 border border-neutral-300">
      <div className="flex gap-4 items-center">
        {navItems.map((item, index) => (
          <div key={item.href} className="flex items-center gap-4">
            {index > 0 && <span className="text-neutral-400">|</span>}
            {pathname === item.href ? (
              <span className="font-medium text-neutral-800">{item.label}</span>
            ) : (
              <Link href={item.href} className="text-blue-600 hover:text-blue-800 underline">
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}
