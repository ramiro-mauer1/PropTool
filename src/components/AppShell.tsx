"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useHardwareCheck } from "@/hooks/useHardwareCheck";
import { useBatchProcessor } from "@/hooks/useBatchProcessor";
import { useEnhanceQueue } from "@/hooks/useEnhanceQueue";
import { useAuthUser, type AuthUser } from "@/hooks/useAuthUser";
import { useToast } from "@/components/Toast";
import { PlinthBrand } from "@/components/PlinthBrand";
import { CarouselImageItem } from "@/components/ui/carousel-circular-image-gallery";
import { Sidebar, SidebarBody, SidebarLink, Links } from "@/components/ui/sidebar";
import { BottomNavBar } from "@/components/ui/bottom-nav-bar";
import { AnimatedSidebarText } from "@/components/AnimatedSidebarText";
import { SendToEnhanceModal } from "@/components/SendToEnhanceModal";
import { ProfileMenu, ProfileAvatar, LoginView, WelcomeFlow, AccountSheet } from "@/components/auth";
import { APP_SECTIONS, isSectionActive, startHref } from "@/components/appSections";
import { BatchImage, WatermarkBBox } from "@/types/batch";
import { detectWatermarkBox, createMaskFromBBox } from "@/utils/textDetector";
import { downloadResult, useDeviceSettings } from "@/lib/settings";

/**
 * Estado que comparten las secciones. Vive en el layout, no en cada página:
 * las fotos del lote y la cola de mejora son blobs en memoria y tienen que
 * sobrevivir al pasar de Limpieza a Mejora de Fotos y volver.
 */
interface Workspace {
  user: AuthUser;
  images: BatchImage[];
  carouselItems: CarouselImageItem[];
  processedIds: string[];
  isProcessing: boolean;
  progress: ReturnType<typeof useBatchProcessor>["progress"];
  cancelBatch: () => void;
  addImages: (files: File[]) => Promise<void>;
  clearBatch: () => void;
  processBatch: () => Promise<void>;
  updateMask: (id: string, maskData: ImageData | null, bbox: WatermarkBBox | null) => void;
  sendImageToEnhance: (id: string) => Promise<void>;
  downloadAllClean: () => void;
  enhanceQueue: ReturnType<typeof useEnhanceQueue>;
  availableCleanCount: number;
  openSendToEnhance: () => void;
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace se usa dentro de AppShell");
  return ctx;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [images, setImages] = useState<BatchImage[]>([]);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountSheetId = useId();

  const { user: authUser, isLoading: authLoading, refresh: refreshAuth } = useAuthUser();
  // The shared layoutId only needs to drive the one-time "fly from login
  // into the sidebar" entrance. Left attached permanently, it fights with
  // PlinthBrand's own width animation every time the sidebar is toggled
  // open/closed afterwards (two competing layout-animation systems on the
  // same subtree), which made the logo vanish — so it's detached once the
  // entrance settles.
  const [logoDocked, setLogoDocked] = useState(false);
  const inApp = !!authUser && !authUser.needsOnboarding;
  useEffect(() => {
    if (!inApp) {
      setLogoDocked(false);
      return;
    }
    const t = setTimeout(() => setLogoDocked(true), 700);
    return () => clearTimeout(t);
  }, [inApp]);

  // `/` es el login. Con sesión, lleva a la herramienta de inicio que eligió
  // el agente; un enlace directo a una sección se respeta tal cual.
  const startModule = authUser?.startModule ?? null;
  useEffect(() => {
    if (inApp && pathname === "/") router.replace(startHref(startModule));
  }, [inApp, pathname, startModule, router]);

  const hardware = useHardwareCheck();
  const { showToast } = useToast();

  // Aplica el tema guardado (claro/oscuro/sistema) y sigue sus cambios desde Configuración.
  useDeviceSettings();

  const {
    isProcessing,
    progress,
    processedIds,
    cleanUrls,
    cleanBlobs,
    processBatch,
    cancelBatch,
    clearData,
  } = useBatchProcessor({
    onError: (errorMessage) => {
      showToast({
        title: "Error de procesamiento",
        message: errorMessage,
        type: "error",
      });
    },
  });

  const enhanceQueue = useEnhanceQueue({
    onError: (err) => {
      showToast({
        title: "Error en Mejora de Fotos",
        message: err,
        type: "error",
      });
    },
    onSuccess: (msg) => {
      showToast({
        title: "Proceso completado",
        message: msg,
        type: "success",
      });
    },
  });

  // Lista de imágenes limpiadas con blob disponible
  const availableCleanImages = useMemo(() => {
    return images.filter((img) => Boolean(cleanBlobs[img.id]));
  }, [images, cleanBlobs]);

  // Enviar lote seleccionado a Mejora de Fotos
  const handleSendToEnhance = useCallback(
    async (files: File[]) => {
      await enhanceQueue.addImages(files);
      router.push("/fotos");
      showToast({
        title: "Imágenes transferidas",
        message: `${files.length} ${files.length === 1 ? "imagen enviada" : "imágenes enviadas"} a Mejora de Fotos.`,
        type: "success",
      });
    },
    [enhanceQueue, showToast, router]
  );

  // Enviar una única imagen desde el carrusel a Mejora de Fotos
  const handleSendSingleToEnhance = useCallback(
    async (id: string) => {
      const img = images.find((i) => i.id === id);
      const blob = cleanBlobs[id];
      if (!img || !blob) return;

      const baseName = img.file.name.replace(/\.[^/.]+$/, "");
      const file = new File([blob], `${baseName}_limpia.png`, {
        type: blob.type || "image/png",
      });

      await enhanceQueue.addImages([file]);
      router.push("/fotos");
      showToast({
        title: "Imagen transferida",
        message: "Fotografía enviada a Mejora de Fotos.",
        type: "success",
      });
    },
    [images, cleanBlobs, enhanceQueue, showToast, router]
  );

  const handleFilesAdded = useCallback(async (files: File[]) => {
    const newImages: BatchImage[] = await Promise.all(
      files.map(async (file) => {
        const fileSizeKB = Math.round(file.size / 1024);
        let naturalWidth = 0;
        let naturalHeight = 0;
        let isLowQuality = false;

        try {
          const bitmap = await createImageBitmap(file);
          naturalWidth = bitmap.width;
          naturalHeight = bitmap.height;
          const longestSide = Math.max(naturalWidth, naturalHeight);
          const totalPixels = naturalWidth * naturalHeight;
          const bitsPerPixel = totalPixels > 0 ? (file.size * 8) / totalPixels : 0;

          isLowQuality =
            longestSide < 800 ||
            (longestSide < 1200 && bitsPerPixel < 0.8);
          bitmap.close();
        } catch {
          isLowQuality = true;
        }

        return {
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          naturalWidth,
          naturalHeight,
          fileSizeKB,
          isLowQuality,
        };
      })
    );

    setImages((prev) => [...prev, ...newImages]);

    // Detección automática en segundo plano
    Promise.all(
      newImages.map(async (img) => {
        try {
          const bitmap = await createImageBitmap(img.file);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(bitmap, 0, 0);
            const bbox = await detectWatermarkBox(canvas);
            if (bbox) {
              const maskData = createMaskFromBBox(bitmap.width, bitmap.height, bbox);
              setImages((prev) =>
                prev.map((item) =>
                  item.id === img.id
                    ? { ...item, autoMaskBBox: bbox, maskData }
                    : item
                )
              );
            }
          }
        } catch (err) {
          console.warn("[AppShell] Error autodetectando marca:", err);
        }
      })
    );
  }, []);

  const clearBatch = useCallback(() => {
    if (isProcessing) cancelBatch();
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    clearData();
    setImages([]);
  }, [images, isProcessing, cancelBatch, clearData]);

  const handleDownloadAllClean = useCallback(() => {
    processedIds.forEach((id) => {
      const url = cleanUrls[id];
      const img = images.find((i) => i.id === id);
      if (url && img) {
        const fileName = img.file.name.replace(/\.[^/.]+$/, "");
        void downloadResult(url, `${fileName}_limpia`);
      }
    });
  }, [processedIds, cleanUrls, images]);

  const handleProcessBatch = useCallback(async () => {
    let currentImages = images;

    const unmasked = currentImages.filter(
      (img) => !img.maskData && !processedIds.includes(img.id)
    );

    if (unmasked.length > 0) {
      currentImages = await Promise.all(
        currentImages.map(async (img) => {
          if (!img.maskData && !processedIds.includes(img.id)) {
            try {
              const bitmap = await createImageBitmap(img.file);
              const canvas = document.createElement("canvas");
              canvas.width = bitmap.width;
              canvas.height = bitmap.height;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(bitmap, 0, 0);
                const bbox = img.autoMaskBBox || (await detectWatermarkBox(canvas));
                if (bbox) {
                  const maskData = createMaskFromBBox(bitmap.width, bitmap.height, bbox);
                  return { ...img, autoMaskBBox: bbox, maskData };
                }
              }
            } catch (e) {
              console.warn("Error generando máscara para imagen:", img.id, e);
            }
          }
          return img;
        })
      );
      setImages(currentImages);
    }

    const pendingImages = currentImages.filter(
      (img) => img.maskData && !processedIds.includes(img.id)
    );

    if (pendingImages.length > 0) {
      processBatch(pendingImages, hardware.isCapable);
    } else {
      showToast({
        title: "Sin imágenes pendientes",
        message: "Todas las fotos ya fueron limpiadas o no tienen máscara asignada.",
        type: "warning",
      });
    }
  }, [images, processedIds, processBatch, hardware.isCapable, showToast]);

  const handleUpdateMask = useCallback(
    (
      id: string,
      maskData: ImageData | null,
      bbox: WatermarkBBox | null
    ) => {
      setImages((prev) =>
        prev.map((img) =>
          img.id === id
            ? {
                ...img,
                maskData: maskData || undefined,
                autoMaskBBox: bbox || undefined,
              }
            : img
        )
      );
    },
    []
  );

  const carouselItems: CarouselImageItem[] = useMemo(() => {
    return images.map((img) => ({
      id: img.id,
      file: img.file,
      title: img.file.name,
      previewUrl: img.previewUrl,
      cleanUrl: cleanUrls[img.id],
      isProcessed: processedIds.includes(img.id),
      autoMaskBBox: img.autoMaskBBox,
      maskData: img.maskData,
      isLowQuality: img.isLowQuality,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));
  }, [images, cleanUrls, processedIds]);

  // Pendientes por sección: badge en la barra lateral, punto en la inferior.
  const sectionCounts: Partial<Record<string, number>> = {
    inpainting: images.length,
    enhance: enhanceQueue.queue.length,
  };

  // Enlaces de navegación del Sidebar (escritorio)
  const sidebarLinks: Links[] = APP_SECTIONS.map((section) => {
    const Icon = section.icon;
    const count = sectionCounts[section.module] ?? 0;
    return {
      label: section.label,
      href: section.href,
      active: isSectionActive(section, pathname),
      icon: <Icon className="w-5 h-5 flex-shrink-0" />,
      badge:
        count > 0 ? (
          <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-[#d4ff32] text-[#08090a] font-semibold shadow-2xs">
            {count}
          </span>
        ) : null,
    };
  });

  const bottomNavItems = APP_SECTIONS.map((section) => ({
    ...section,
    count: sectionCounts[section.module],
  }));

  const closeAccount = useCallback(() => setAccountOpen(false), []);

  const workspace: Workspace | null = authUser
    ? {
        user: authUser,
        images,
        carouselItems,
        processedIds,
        isProcessing,
        progress,
        cancelBatch,
        addImages: handleFilesAdded,
        clearBatch,
        processBatch: handleProcessBatch,
        updateMask: handleUpdateMask,
        sendImageToEnhance: handleSendSingleToEnhance,
        downloadAllClean: handleDownloadAllClean,
        enhanceQueue,
        availableCleanCount: availableCleanImages.length,
        openSendToEnhance: () => setShowEnhanceModal(true),
      }
    : null;

  if (authLoading) {
    return <div className="min-h-[100dvh] w-full bg-[#09090B]" />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!authUser ? (
        <LoginView key="login" onSuccess={refreshAuth} />
      ) : authUser.needsOnboarding ? (
        <WelcomeFlow key="welcome" user={authUser} onDone={() => void refreshAuth()} />
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="h-[100dvh] w-full flex flex-col md:flex-row overflow-hidden bg-[#FAFAFA] dark:bg-[#09090B] text-[#18181B] dark:text-[#FAFAFA] transition-colors duration-150"
        >
          {/* ================= SIDEBAR ANIMADO ================= */}
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
            <SidebarBody
              className="justify-between gap-6 bg-[#0f1115] border-white/[0.08]"
              mobileHeader={<PlinthBrand isCollapsed={false} className="h-6 text-white shrink-0" />}
            >
              <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
                {/* Logo y Marca */}
                <div className={`flex items-center select-none mb-6 transition-all duration-300 ${sidebarOpen ? 'justify-start px-2.5 py-5' : 'justify-center px-0 py-5'}`}>
                  <motion.div
                    layoutId={logoDocked ? undefined : "plinth-logo"}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                    className="h-7"
                  >
                    <PlinthBrand isCollapsed={!sidebarOpen} className="h-full text-white" />
                  </motion.div>
                </div>

                {/* Módulos Principales */}
                <div className="flex flex-col gap-1.5">
                  <AnimatedSidebarText className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#8f96a3] mb-1">
                    Herramientas
                  </AnimatedSidebarText>
                  {sidebarLinks.map((link) => (
                    <SidebarLink key={link.href} link={link} />
                  ))}
                </div>
              </div>

              {/* Perfil del agente */}
              <div className="border-t border-white/[0.08] pt-3">
                <ProfileMenu user={authUser} onProfileUpdated={refreshAuth} />
              </div>
            </SidebarBody>
          </Sidebar>

          {/* ================= ÁREA PRINCIPAL =================
              En celular deja libre el alto de la barra inferior: así ninguna
              sección queda con su última tarjeta o botón debajo de ella. */}
          <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative pb-[var(--bottom-nav-space)] bg-[#FAFAFA] dark:bg-[#09090B] transition-colors duration-150">
            <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>
          </main>

          <BottomNavBar
            items={bottomNavItems}
            account={{
              icon: <ProfileAvatar user={authUser} className="w-7 h-7 text-[10px]" />,
              expanded: accountOpen,
              controls: accountSheetId,
              onOpen: () => setAccountOpen(true),
            }}
          />

          <AccountSheet
            id={accountSheetId}
            user={authUser}
            open={accountOpen}
            onClose={closeAccount}
            onProfileUpdated={refreshAuth}
          />

          {/* Modal para enviar fotografías a Mejora de Fotos */}
          <SendToEnhanceModal
            isOpen={showEnhanceModal}
            onClose={() => setShowEnhanceModal(false)}
            images={images}
            cleanUrls={cleanUrls}
            cleanBlobs={cleanBlobs}
            maxAllowed={Math.max(0, 5 - enhanceQueue.queue.length)}
            onConfirm={handleSendToEnhance}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
