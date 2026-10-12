import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-end justify-between gap-3 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4", className)}>
      <div className="min-w-0">
        {subtitle && <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>}
        <h1 className="truncate text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-6">{icon}</div>
      <div className="font-semibold">{title}</div>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
