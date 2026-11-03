import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

/** Precached by public/sw.js and served when a page isn't in the cache and the network is down. */
export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <WifiOff aria-hidden className="size-10 text-muted" strokeWidth={1.5} />
      <h1 className="mt-4 text-lg font-semibold">You&apos;re offline</h1>
      <p className="mt-1 text-sm text-muted">
        This page hasn&apos;t been cached yet. Pages you&apos;ve visited and the product catalog stay available offline.
      </p>
      <Link href="/catalog" className={`${buttonClasses()} mt-6`}>
        Open cached catalog
      </Link>
    </main>
  );
}
