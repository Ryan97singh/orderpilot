"use client";

import { Download, MoreVertical, Share, SquarePlus, X } from "lucide-react";
import { useState } from "react";
import { promptInstall, useInstallPlatform } from "@/lib/install";
import { cn } from "@/lib/format";
import { Button } from "./ui/button";

/**
 * "Install app" for the PWA. Chromium (Android, desktop Chrome/Edge) gets the native install dialog;
 * iOS Safari has no install API, so it shows the Share → Add to Home Screen steps instead.
 * Hidden once the app runs installed.
 */
export function InstallButton({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  const platform = useInstallPlatform();
  const [showHelp, setShowHelp] = useState(false);

  if (platform === "installed") return null;

  const onClick = async () => {
    if (platform === "prompt") await promptInstall();
    else setShowHelp((open) => !open);
  };

  return (
    <div className={cn("relative", className)}>
      <Button variant="secondary" size={size} onClick={onClick} aria-expanded={platform === "prompt" ? undefined : showHelp}>
        <Download aria-hidden className="size-4" />
        <span className="sm:hidden">Install</span>
        <span className="max-sm:hidden">Install app</span>
      </Button>
      {showHelp && (
        <div
          role="dialog"
          aria-label="How to install OrderPilot"
          className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-4 text-sm shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">Install OrderPilot</p>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="rounded-md p-1 text-muted hover:bg-surface-muted"
              aria-label="Close"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          {platform === "ios" ? (
            <ol className="space-y-2 text-muted">
              <li className="flex gap-2">
                <span className="font-medium text-foreground">1.</span>
                <span>
                  In Safari, tap <Share aria-label="Share" className="inline size-4 align-text-bottom text-foreground" />{" "}
                  <span className="font-medium text-foreground">Share</span>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">2.</span>
                <span>
                  Choose <SquarePlus aria-hidden className="inline size-4 align-text-bottom text-foreground" />{" "}
                  <span className="font-medium text-foreground">Add to Home Screen</span>, then Add.
                </span>
              </li>
              <li className="text-xs">On iPhone this only works in Safari, not in Chrome or in-app browsers.</li>
            </ol>
          ) : (
            <ol className="space-y-2 text-muted">
              <li className="flex gap-2">
                <span className="font-medium text-foreground">1.</span>
                <span>
                  Open the browser menu <MoreVertical aria-label="menu" className="inline size-4 align-text-bottom text-foreground" />.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">2.</span>
                <span>
                  Tap <span className="font-medium text-foreground">Install app</span> or{" "}
                  <span className="font-medium text-foreground">Add to Home screen</span>.
                </span>
              </li>
              <li className="text-xs">Use Chrome, Edge or Samsung Internet. Opening the link inside WhatsApp or Gmail won&apos;t offer install.</li>
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
