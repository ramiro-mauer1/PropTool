"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

export interface Links {
  label: string;
  href?: string;
  icon: React.JSX.Element | React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  badge?: React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <div
      className={cn(
        "hidden md:block h-full flex-shrink-0 bg-[#0f1115] relative z-40"
      )}
      style={{ 
        width: animate ? "64px" : "280px",
        minWidth: animate ? "64px" : "280px",
        maxWidth: animate ? "64px" : "280px"
      }}
    >
      <motion.div
        className={cn(
          "h-full px-3 py-4 flex flex-col bg-[#0f1115] border-r border-white/[0.08] flex-shrink-0 text-white absolute left-0 top-0 z-[100] overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/5 will-change-[width]",
          className
        )}
        initial={false}
        animate={{
          width: animate ? (open ? "280px" : "64px") : "280px",
        }}
        transition={{
          duration: 0.45,
          ease: [0.25, 1, 0.5, 1],
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        {...props}
      >
        {children}
      </motion.div>
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-14 px-4 flex flex-row md:hidden items-center justify-between bg-[#0f1115] border-b border-white/[0.08] text-white w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-[#8f96a3] hover:text-white cursor-pointer"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.45,
                ease: [0.25, 1, 0.5, 1],
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-[#0f1115] p-6 z-[100] flex flex-col justify-between text-white",
                className
              )}
            >
              <div
                className="absolute right-6 top-6 z-50 text-[#8f96a3] hover:text-white cursor-pointer p-1 rounded-md hover:bg-white/[0.08]"
                onClick={() => setOpen(!open)}
              >
                <X className="w-5 h-5" />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps;
}) => {
  const { open, animate } = useSidebar();

  const content = (
    <div className="flex items-center justify-between w-full min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          "flex-shrink-0 flex items-center justify-center transition-colors",
          link.active ? "text-[#d4ff32]" : "text-[#8f96a3] group-hover/sidebar:text-zinc-200"
        )}>
          {link.icon}
        </div>
        <motion.span
          initial={false}
          animate={{
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          transition={{
            duration: 0.35,
            ease: "easeInOut",
          }}
          className={cn(
            "text-sm font-medium whitespace-nowrap truncate !p-0 !m-0 transition-colors",
            link.active ? "text-white" : "text-[#8f96a3] group-hover/sidebar:text-white"
          )}
          style={{
            pointerEvents: open ? "auto" : "none",
          }}
        >
          {link.label}
        </motion.span>
      </div>
      {link.badge && (
        <motion.div
          initial={false}
          animate={{
            opacity: animate ? (open ? 1 : 0) : 1,
            scale: animate ? (open ? 1 : 0.85) : 1,
          }}
          transition={{
            duration: 0.35,
            ease: "easeInOut",
          }}
          className="shrink-0 whitespace-nowrap"
          style={{
            pointerEvents: open ? "auto" : "none",
          }}
        >
          {link.badge}
        </motion.div>
      )}
    </div>
  );

  const baseClasses = cn(
    "flex items-center justify-start py-2 px-2.5 rounded-lg transition-all duration-150 group/sidebar cursor-pointer active:scale-[0.98]",
    link.active
      ? "bg-transparent text-[#ffffff] font-medium border-l-[1.5px] border-[#d4ff32] rounded-none"
      : "text-[#8f96a3] hover:text-white hover:bg-white/[0.02]",
    className
  );

  if (link.onClick) {
    return (
      <button
        type="button"
        onClick={link.onClick}
        className={cn(baseClasses, "w-full text-left")}
      >
        {content}
      </button>
    );
  }

  console.log("RENDERING LINK WITH HREF:", link.href, "FALLBACK:", link.href || "#");

  return (
    <Link
      href={link.href || "#"}
      className={baseClasses}
      {...props}
    >
      {content}
    </Link>
  );
};
