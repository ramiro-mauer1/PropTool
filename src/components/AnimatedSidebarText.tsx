"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { motion } from "framer-motion";

export const AnimatedSidebarText = ({
  children,
  className,
  display = "inline-block",
}: {
  children: React.ReactNode;
  className?: string;
  display?: string;
}) => {
  const { open, animate } = useSidebar();
  return (
    <motion.span
      initial={false}
      animate={{
        opacity: animate ? (open ? 1 : 0) : 1,
      }}
      transition={{
        duration: 0.35,
        ease: "easeInOut",
      }}
      className={className}
      style={{
        display: display,
        whiteSpace: "nowrap",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {children}
    </motion.span>
  );
};
