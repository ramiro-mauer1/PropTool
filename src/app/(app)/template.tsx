"use client";

import { motion, useReducedMotion } from "framer-motion";

// A diferencia del layout, el template se vuelve a montar en cada
// navegación: da el fundido de entrada de cada sección.
export default function SectionTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col h-full min-h-0 overflow-hidden"
    >
      {children}
    </motion.div>
  );
}
