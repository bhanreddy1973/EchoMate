"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import { useEmotion } from "@/context/EmotionContext";

interface AnimatedBorderProps {
  children: ReactNode;
  className?: string;
  active?: boolean;
}

export default function AnimatedBorder({ children, className = "", active = false }: AnimatedBorderProps) {
  const { accentColor } = useEmotion();

  return (
    <div className={`relative ${className}`}>
      {/* Animated gradient border */}
      {active && (
        <motion.div
          className="absolute -inset-[1px] rounded-2xl opacity-60"
          style={{
            background: `conic-gradient(from 0deg, ${accentColor}, transparent 60%, ${accentColor})`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      )}
      {/* Content with dark bg to show border */}
      <div className="relative rounded-2xl bg-[#070710]">
        {children}
      </div>
    </div>
  );
}
