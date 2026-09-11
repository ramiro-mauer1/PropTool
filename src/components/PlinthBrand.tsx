"use client";

import React from "react";
import { motion } from "framer-motion";

export const PlinthBrand = ({ 
  className = "h-12",
  isCollapsed = false 
}: { 
  className?: string;
  isCollapsed?: boolean;
}) => {
  return (
    <div className={`flex items-center ${className}`}>
      {/* 1. Elemento Fijo: "P" */}
      <svg
        viewBox="144 394 151 196"
        className="h-full w-auto fill-current shrink-0"
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform="translate(0,1024) scale(0.1,-0.1)" stroke="none">
          <path d="M1440 5211 l0 -841 235 0 235 0 0 220 0 220 193 0 c203 0 328 14 427 48 224 77 364 232 405 446 19 98 19 154 0 253 -22 116 -65 195 -154 283 -101 101 -219 160 -378 191 -34 6 -241 13 -510 16 l-453 5 0 -841z m797 459 c165 -21 243 -115 230 -276 -6 -82 -41 -137 -107 -171 -65 -33 -134 -43 -301 -43 l-149 0 0 243 c0 134 3 247 7 250 10 10 237 8 320 -3z" />
        </g>
      </svg>

      {/* 2. Elemento Colapsable: "linth" */}
      <motion.div
        className="overflow-hidden flex h-full shrink-0"
        initial={false}
        animate={{ 
          width: isCollapsed ? 0 : "auto", 
          opacity: isCollapsed ? 0 : 1 
        }}
        transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
      >
        <svg
          viewBox="295 394 538 196"
          className="h-full w-auto fill-current shrink-0"
          style={{ minWidth: "max-content" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform="translate(0,1024) scale(0.1,-0.1)" stroke="none">
            <path d="M3090 5260 l0 -890 225 0 225 0 0 890 0 890 -225 0 -225 0 0 -890z" />
            <path d="M3740 5020 l0 -650 230 0 230 0 0 650 0 650 -230 0 -230 0 0 -650z" />
            <path d="M3909 6290 c-104 -18 -177 -80 -204 -175 -29 -97 3 -184 88 -246 103 -74 276 -68 372 13 69 59 101 199 62 274 -52 99 -188 156 -318 134z" />
            <path d="M5102 5675 c-82 -18 -155 -52 -219 -104 l-53 -41 0 70 0 70 -215 0 -215 0 0 -650 0 -650 224 0 225 0 4 368 c4 416 4 419 78 494 53 53 102 71 190 70 97 0 149 -38 186 -134 14 -36 17 -101 21 -420 l4 -378 224 0 224 0 0 404 c0 462 -7 534 -65 653 -97 199 -356 304 -613 248z" />
            <path d="M6020 5790 l0 -170 -95 0 -95 0 0 -170 0 -170 95 0 95 0 0 -229 c0 -126 5 -265 11 -308 25 -190 132 -311 324 -369 92 -28 307 -26 400 3 120 38 117 26 55 204 -29 85 -54 155 -55 157 -1 1 -16 -5 -34 -14 -44 -22 -139 -29 -171 -12 -13 7 -35 29 -47 47 -22 33 -23 41 -23 277 l0 244 145 0 145 0 0 170 0 170 -145 0 -145 0 0 170 0 170 -230 0 -230 0 0 -170z" />
            <path d="M6950 5260 l0 -890 224 0 225 0 3 373 c3 333 5 376 21 412 43 95 126 147 236 147 73 1 109 -13 154 -57 52 -53 57 -93 57 -502 l0 -373 231 0 231 0 -4 443 c-5 480 -7 496 -65 617 -36 74 -123 159 -203 198 -195 96 -465 74 -622 -50 l-38 -30 0 301 0 301 -225 0 -225 0 0 -890z" />
          </g>
        </svg>
      </motion.div>

      {/* 3. Punto Acid Lime */}
      <motion.svg
        viewBox="833 394 73 196"
        className="h-full w-auto shrink-0"
        preserveAspectRatio="xMidYMid meet"
        layout
      >
        <circle cx="878.2" cy="561.15" r="27.25" fill="#D4FF32" />
      </motion.svg>
    </div>
  );
};
