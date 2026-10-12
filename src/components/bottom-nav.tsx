"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLine, Dumbbell, History, House, Library } from "lucide-react";

import { cn } from "@/lib/utils";
import { useActiveWorkout } from "@/hooks/use-data";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/history", label: "History", icon: History },
  { href: "/workout", label: "Workout", icon: Dumbbell, center: true },
  { href: "/exercises", label: "Exercises", icon: Library },
  { href: "/progress", label: "Progress", icon: ChartLine },
];

export function BottomNav() {
  const pathname = usePathname();
  const active = useActiveWorkout();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid h-[4.25rem] max-w-lg grid-cols-5 items-center px-2">
        {items.map(({ href, label, icon: Icon, center }) => {
          const selected = href === "/" ? pathname === "/" : pathname.startsWith(href);
          if (center) {
            return (
              <Link key={href} href={href} className="flex flex-col items-center justify-center" aria-label={label}>
                <span
                  className={cn(
                    "relative flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95",
                    selected && "ring-4 ring-primary/25",
                  )}
                >
                  <Icon className="size-6" />
                  {active && (
                    <span className="absolute -top-1 -right-1 size-3 animate-pulse rounded-full border-2 border-background bg-red-500" />
                  )}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors",
                selected && "text-foreground",
              )}
            >
              <Icon className={cn("size-5", selected && "text-primary")} strokeWidth={selected ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
