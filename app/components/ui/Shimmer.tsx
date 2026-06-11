"use client";

import { cn } from "@/lib/utils";

interface ShimmerProps {
  className?: string;
  width?: string;
  height?: string;
}

export default function Shimmer({ className, width = "100%", height = "16px" }: ShimmerProps) {
  return (
    <div
      className={cn(
        "rounded-lg relative overflow-hidden",
        className
      )}
      style={{
        width,
        height,
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 2s ease-in-out infinite",
        }}
      />
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 px-6 py-4">
      <Shimmer className="!rounded-full shrink-0" width="28px" height="28px" />
      <div className="flex-1 space-y-2">
        <Shimmer width="75%" height="14px" />
        <Shimmer width="60%" height="14px" />
        <Shimmer width="40%" height="14px" />
      </div>
    </div>
  );
}
