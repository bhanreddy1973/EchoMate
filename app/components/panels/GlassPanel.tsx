"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";
import clsx from "clsx";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  delay?: number;
  noPad?: boolean;
}

export default function GlassPanel({ children, className, accent, delay = 0, noPad }: GlassPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={clsx(
        "relative glass glass-specular overflow-hidden",
        accent && "glass-accent",
        !noPad && "p-5",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
