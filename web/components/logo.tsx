import Link from "next/link";
import { cn } from "@/lib/format";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg bg-primary text-[0.8rem] font-bold tracking-tight text-primary-foreground",
        className,
      )}
    >
      OP
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-lg font-semibold tracking-tight">
      <LogoMark />
      <span>OrderPilot</span>
    </Link>
  );
}
