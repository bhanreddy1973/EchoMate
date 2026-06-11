"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  variant?: "default" | "subtle" | "premium" | "accent";
  glow?: boolean;
  glowColor?: string;
  className?: string;
  hover?: boolean;
}

export default function GlassCard({
  children,
  variant = "default",
  glow = false,
  glowColor,
  className,
  hover = true,
  ...props
}: GlassCardProps) {
  const variants = {
    default: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(40px) saturate(180%)",
    },
    subtle: {
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.05)",
      backdropFilter: "blur(20px) saturate(150%)",
    },
    premium: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(40px) saturate(200%) brightness(1.05)",
    },
    accent: {
      background: `${glowColor || "rgba(99,102,241,0.45)"}08`,
      border: `1px solid ${glowColor || "rgba(99,102,241,0.45)"}20`,
      backdropFilter: "blur(40px) saturate(180%)",
    },
  };

  const style = variants[variant];

  return (
    <motion.div
      className={cn(
        "relative rounded-2xl overflow-hidden",
        hover && "transition-all duration-300",
        className
      )}
      style={{
        ...style,
        boxShadow: glow
          ? `0 4px 16px -4px rgba(0,0,0,0.4), 0 0 20px -8px ${glowColor || "rgba(99,102,241,0.2)"}`
          : "0 4px 16px -4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
      whileHover={
        hover
          ? {
              y: -2,
              boxShadow: glow
                ? `0 8px 32px -4px rgba(0,0,0,0.5), 0 0 30px -8px ${glowColor || "rgba(99,102,241,0.3)"}`
                : "0 8px 32px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)",
            }
          : undefined
      }
      {...props}
    >
      {/* Specular highlight */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 30%, transparent 60%)",
        }}
      />
      <div className="relative">{children}</div>
    </motion.div>
  );
}
