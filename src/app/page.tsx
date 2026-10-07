"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  Upload,
  Download,
  Trash2,
  Sparkles,
  CheckCircle2,
  Loader2,
  FolderSync,
  ChevronLeft,
  Wand2,
  Maximize2,
  ShieldCheck,
  Users,
  Cpu,
  MoreHorizontal,
  Radar,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useHardwareCheck } from "@/hooks/useHardwareCheck";
import { useBatchProcessor } from "@/hooks/useBatchProcessor";
import { useEnhanceQueue } from "@/hooks/useEnhanceQueue";
import { BatchProgress } from "@/components/BatchProgress";
import { PlinthBrand } from "@/components/PlinthBrand";
import {
  ImageGallery,
  CarouselImageItem,
} from "@/components/ui/carousel-circular-image-gallery";
import { useToast } from "@/components/Toast";
import { BatchImage, WatermarkBBox } from "@/types/batch";
import { detectWatermarkBox, createMaskFromBBox } from "@/utils/textDetector";
import { EnhanceWorkspace } from "@/components/EnhanceWorkspace";
import { SendToEnhanceModal } from "@/components/SendToEnhanceModal";
import { Sidebar, SidebarBody, SidebarLink, Links } from "@/components/ui/sidebar";
import { StudioDropzone } from "@/components/StudioDropzone";
import { AnimatedSidebarText } from "@/components/AnimatedSidebarText";
import { PropertyFinderModule } from "@/components/property-finder";
import { CrmAssistantModule } from "@/components/crm-assistant";
import { CaptacionesModule } from "@/components/captaciones";
import { ProfileMenu, LoginView, WelcomeFlow } from "@/components/auth";
import { MobileModuleSwitcher } from "@/components/MobileModuleSwitcher";
import { useAuthUser } from "@/hooks/useAuthUser";
import { downloadResult, useDeviceSettings } from "@/lib/settings";

export default function HomePage() {
  const [activeModule, setActiveModule] = useState<"inpainting" | "enhance" | "captaciones" | "crm" | "finder">("inpainting");
  const [images, setImages] = useState<BatchImage[]>([]);
  const [showEnhanceModal, setShowEnhanceModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Menú de acciones secundarias del lote (sólo móvil: en escritorio los
  // botones entran todos en la barra).
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);

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

  // Abre la herramienta de inicio elegida por el agente, una vez por sesión.
  const startModuleApplied = useRef(false);
  useEffect(() => {
    if (!authUser) {
      startModuleApplied.current = false;
      return;
    }
    if (startModuleApplied.current || authUser.needsOnboarding) return;
    startModuleApplied.current = true;
    if (authUser.startModule) setActiveModule(authUser.startModule);
  }, [authUser]);
  const hardware = useHardwareCheck();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setActiveModule("enhance");
      showToast({
        title: "Imágenes transferidas",
        message: `${files.length} ${files.length === 1 ? "imagen enviada" : "imágenes enviadas"} a Mejora de Fotos.`,
        type: "success",
      });
    },
    [enhanceQueue, showToast]
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
      setActiveModule("enhance");
      showToast({
        title: "Imagen transferida",
        message: "Fotografía enviada a Mejora de Fotos.",
        type: "success",
      });
    },
    [images, cleanBlobs, enhanceQueue, showToast]
  );

  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Import external property photos into the enhance queue via the image proxy
  const handleImportFromFinder = useCallback(
    async (imageUrls: string[]) => {
      const urlsToFetch = imageUrls.slice(0, 5); // max 5 photos at once
      const files: File[] = [];

      await Promise.allSettled(
        urlsToFetch.map(async (url, i) => {
          try {
            const proxied = `/api/property-finder/proxy-image?url=${encodeURIComponent(url)}`;
            const res = await fetch(proxied);
            if (!res.ok) return;
            const blob = await res.blob();
            if (blob.size === 0) return;
            const ext = blob.type.includes("png") ? "png" : "jpg";
            files.push(
              new File([blob], `propiedad-foto-${i + 1}.${ext}`, {
                type: blob.type || "image/jpeg",
              })
            );
          } catch {
            console.warn("[Finder] Could not fetch image:", url);
          }
        })
      );

      if (files.length > 0) {
        await enhanceQueue.addImages(files);
        setActiveModule("enhance");
        showToast({
          title: "Fotos importadas al Studio",
          message: `${files.length} ${files.length === 1 ? "foto importada" : "fotos importadas"} a Mejora de Fotos.`,
          type: "success",
        });
      } else {
        showToast({
          title: "Sin fotos disponibles",
          message: "No se pudieron descargar las imágenes de esta propiedad.",
          type: "warning",
        });
      }
    },
    [enhanceQueue, showToast]
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
          console.warn("[page] Error autodetectando marca:", err);
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

  const pendingCount = images.length - processedIds.length;
  const isAllProcessed = images.length > 0 && pendingCount === 0;

  // Enlaces de navegación del Sidebar
  const sidebarLinks: Links[] = useMemo(
    () => [
      {
        label: "Captaciones",
        onClick: () => setActiveModule("captaciones"),
        active: activeModule === "captaciones",
        icon: <Radar className="w-5 h-5 flex-shrink-0" />,
      },
      {
        label: "Cartera Inteligente",
        onClick: () => setActiveModule("crm"),
        active: activeModule === "crm",
        icon: <Users className="w-5 h-5 flex-shrink-0" />,
      },
      {
        label: "Limpieza Inteligente",
        onClick: () => setActiveModule("inpainting"),
        active: activeModule === "inpainting",
        icon: <Wand2 className="w-5 h-5 flex-shrink-0" />,
        badge:
          images.length > 0 ? (
            <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-[#d4ff32] text-[#08090a] font-semibold shadow-2xs">
              {images.length}
            </span>
          ) : null,
      },
      {
        label: "Mejora de Fotos",
        onClick: () => setActiveModule("enhance"),
        active: activeModule === "enhance",
        icon: <Maximize2 className="w-5 h-5 flex-shrink-0" />,
        badge:
          enhanceQueue.queue.length > 0 ? (
            <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-[#d4ff32] text-[#08090a] font-semibold shadow-2xs">
              {enhanceQueue.queue.length}
            </span>
          ) : null,
      },
    ],
    [activeModule, images.length, enhanceQueue.queue.length]
  );




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
      {/* Input de subida unificado */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files).filter((file) =>
              file.type.match(/^image\/(jpeg|png|webp)$/)
            );
            if (files.length > 0) {
              if (activeModule === "inpainting") {
                handleFilesAdded(files);
              } else {
                enhanceQueue.addImages(files);
              }
            }
            e.target.value = "";
          }
        }}
      />

      {/* ================= SIDEBAR ANIMADO ================= */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
        <SidebarBody
          className="justify-between gap-6 bg-[#0f1115] border-white/[0.08]"
          mobileHeader={
            <div className="flex items-center gap-3 min-w-0">
              <PlinthBrand isCollapsed={false} className="h-6 text-white shrink-0" />
              <MobileModuleSwitcher links={sidebarLinks} />
            </div>
          }
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
              {sidebarLinks.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>

          {/* Perfil del agente */}
          <div className="border-t border-white/[0.08] pt-3">
            <ProfileMenu user={authUser} onProfileUpdated={refreshAuth} />
          </div>
        </SidebarBody>
      </Sidebar>

      {/* ================= ÁREA PRINCIPAL ================= */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Barra de acción contextual superior (solo cuando hay fotos en Inpainting) */}
        {activeModule === "inpainting" && images.length > 0 && (
          <div className="h-12 border-b border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-2 px-3 sm:px-6 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-sm shrink-0 z-20">
            {/* Métricas del lote */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs min-w-0">
              <button
                type="button"
                onClick={clearBatch}
                className="flex items-center gap-1.5 h-9 sm:h-8 px-2.5 shrink-0 rounded-md bg-zinc-100 dark:bg-[#27272A] hover:bg-zinc-200 dark:hover:bg-[#323238] border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors group active:scale-[0.98]"
                title="Volver al inicio"
                aria-label="Volver al inicio"
              >
                <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="hidden sm:inline">Inicio</span>
              </button>

              <span className="font-semibold text-[#18181B] dark:text-[#FAFAFA] truncate">
                <span className="hidden sm:inline">Lote de </span>
                {images.length} {images.length === 1 ? "foto" : "fotos"}
              </span>

              <span className="hidden xs:block w-1 h-1 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />

              <div className="hidden xs:flex items-center gap-2 text-2xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                <span className="flex items-center gap-1 text-accent font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  {processedIds.length}
                  <span className="hidden md:inline">limpias</span>
                </span>
                <span className="hidden md:inline">•</span>
                <span
                  className={`hidden md:inline ${
                    pendingCount > 0
                      ? "text-zinc-700 dark:text-zinc-300 font-medium"
                      : "text-zinc-400"
                  }`}
                >
                  {pendingCount} pendientes
                </span>
              </div>
            </div>

            {/* Acciones principales de lote */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Agregar — en móvil vive dentro del menú "⋯" */}
              <button
                type="button"
                onClick={triggerUpload}
                className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-md bg-white dark:bg-[#27272A] hover:bg-zinc-50 dark:hover:bg-[#323238] border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-[#18181B] dark:text-[#FAFAFA] hover:border-accent transition-colors active:scale-[0.98]"
                title="Agregar más fotografías al lote"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-500" />
                <span>Agregar</span>
              </button>

              {/* Botón principal: Limpiar Marca de Agua */}
              <button
                type="button"
                onClick={handleProcessBatch}
                disabled={isProcessing || isAllProcessed}
                className={`flex items-center justify-center gap-1.5 h-9 sm:h-8 px-3 sm:px-4 rounded-md text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] ${
                  isProcessing
                    ? "bg-accent/80 text-zinc-950 cursor-wait"
                    : isAllProcessed
                    ? "bg-zinc-200 dark:bg-[#27272A] text-zinc-400 dark:text-zinc-500 border border-zinc-300 dark:border-zinc-700 cursor-default"
                    : "bg-accent text-zinc-950 hover:bg-accent-hover shadow-subtle"
                }`}
                title={
                  isAllProcessed
                    ? "Todas las fotografías del lote ya están limpias"
                    : isProcessing
                    ? "Procesando fotografías..."
                    : "Ejecutar limpieza con IA en fotos pendientes"
                }
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span className="hidden sm:inline">Limpiando marca de agua...</span>
                    <span className="sm:hidden">Limpiando…</span>
                  </>
                ) : isAllProcessed ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="hidden sm:inline">Lote completado</span>
                    <span className="sm:hidden">Listo</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span className="hidden lg:inline">
                      Limpiar Marca de Agua ({pendingCount})
                    </span>
                    <span className="lg:hidden">Limpiar ({pendingCount})</span>
                  </>
                )}
              </button>

              {/* Enviar a Mejora de Fotos */}
              {processedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEnhanceModal(true)}
                  className="hidden md:flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-white dark:bg-[#27272A] hover:bg-zinc-50 dark:hover:bg-[#323238] border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-[#18181B] dark:text-[#FAFAFA] hover:border-accent hover:text-accent transition-colors active:scale-[0.98]"
                  title="Transferir imágenes limpiadas a Mejora de Fotos"
                >
                  <FolderSync className="w-3.5 h-3.5 text-accent" />
                  <span>Enviar a Mejora ({processedIds.length})</span>
                </button>
              )}

              {/* Descargar limpias (Accent) */}
              {processedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadAllClean}
                  className="hidden md:flex items-center gap-1.5 h-8 px-3 rounded-md bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 text-xs font-semibold transition-colors active:scale-[0.98]"
                  title="Descargar todas las fotos limpiadas"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar ({processedIds.length})</span>
                </button>
              )}

              {/* Vaciar lote */}
              <button
                type="button"
                onClick={clearBatch}
                disabled={isProcessing}
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-colors disabled:opacity-40"
                title="Vaciar lote actual"
                aria-label="Vaciar lote actual"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* ── Menú de acciones secundarias (móvil / tablet) ─────────── */}
              <div className="relative md:hidden">
                <button
                  type="button"
                  onClick={() => setBatchMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={batchMenuOpen}
                  aria-label="Más acciones del lote"
                  className="flex items-center justify-center w-10 h-9 sm:w-9 sm:h-8 rounded-md bg-zinc-100 dark:bg-[#27272A] hover:bg-zinc-200 dark:hover:bg-[#323238] border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors active:scale-[0.98]"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                <AnimatePresence>
                  {batchMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setBatchMenuOpen(false)}
                      />
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute right-0 top-full mt-2 w-60 max-w-[calc(100vw-1.5rem)] z-[70] origin-top-right rounded-xl border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-2xl overflow-hidden p-1.5"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setBatchMenuOpen(false);
                            triggerUpload();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium text-[#18181B] dark:text-[#FAFAFA] hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors text-left"
                        >
                          <Upload className="w-4 h-4 shrink-0 text-zinc-500" />
                          <span>Agregar fotos</span>
                        </button>

                        {processedIds.length > 0 && (
                          <>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setBatchMenuOpen(false);
                                setShowEnhanceModal(true);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium text-[#18181B] dark:text-[#FAFAFA] hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors text-left"
                            >
                              <FolderSync className="w-4 h-4 shrink-0 text-accent" />
                              <span className="truncate">
                                Enviar a Mejora ({processedIds.length})
                              </span>
                            </button>

                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setBatchMenuOpen(false);
                                handleDownloadAllClean();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-semibold text-accent hover:bg-accent/10 transition-colors text-left"
                            >
                              <Download className="w-4 h-4 shrink-0" />
                              <span className="truncate">
                                Descargar limpias ({processedIds.length})
                              </span>
                            </button>
                          </>
                        )}

                        <div className="my-1 h-px bg-zinc-200 dark:bg-[#27272A]" />

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setBatchMenuOpen(false);
                            clearBatch();
                          }}
                          disabled={isProcessing}
                          className="w-full flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40 text-left"
                        >
                          <Trash2 className="w-4 h-4 shrink-0" />
                          <span>Vaciar lote</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Contenido Principal */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#FAFAFA] dark:bg-[#09090B] transition-colors duration-150">
          <AnimatePresence mode="wait">
            {activeModule === "enhance" ? (
              <motion.div
                key="enhance-module"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                <EnhanceWorkspace
                  queueController={enhanceQueue}
                  availableCleanCount={availableCleanImages.length}
                  onOpenImportModal={() => setShowEnhanceModal(true)}
                  onBack={() => setActiveModule("inpainting")}
                />
              </motion.div>
            ) : activeModule === "crm" ? (
              <motion.div
                key="crm-module"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                <CrmAssistantModule agentName={authUser?.name ?? null} preferredName={authUser?.preferredName || null} />
              </motion.div>
            ) : activeModule === "captaciones" ? (
              <motion.div
                key="captaciones-module"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                <CaptacionesModule agentName={authUser?.name ?? null} />
              </motion.div>
            ) : activeModule === "finder" ? (
              <motion.div
                key="finder-module"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                <PropertyFinderModule
                  onImportPhotos={handleImportFromFinder}
                />
              </motion.div>
            ) : (
              <motion.div
                key="inpainting-module"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col h-full overflow-hidden"
              >
                {images.length === 0 ? (
                  <StudioDropzone
                    onFilesSelected={handleFilesAdded}
                  />
                ) : (
                  <div className="flex-1 flex flex-col p-2 sm:p-4 overflow-hidden">
                    {/* Barra de progreso de lote (solo durante inferencia) */}
                    <AnimatePresence>
                      {isProcessing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                          animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                          className="overflow-hidden shrink-0 max-w-2xl mx-auto w-full"
                        >
                          <BatchProgress
                            progress={progress}
                            processedCount={processedIds.length}
                            totalCount={images.length}
                            onCancel={cancelBatch}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Lienzo del Carrusel Maximizado */}
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center overflow-hidden">
                      <ImageGallery
                        items={carouselItems}
                        onUpdateMask={handleUpdateMask}
                        onSendToEnhance={handleSendSingleToEnhance}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

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

      {/* Modal informativo sutil */}
      <AnimatePresence>
        {showHelpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowHelpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] p-5 sm:p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 max-h-[85dvh] overflow-y-auto overscroll-contain"
            >
              <div className="flex items-center justify-between border-b border-[#E4E4E7] dark:border-[#27272A] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#FAFAFA]">
                    Plinth · Real Estate OS
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-white text-xs px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-[#27272A]"
                >
                  Cerrar
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
                <div>
                  <h4 className="font-semibold text-[#18181B] dark:text-[#FAFAFA] mb-1 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-accent" />
                    Limpieza de Marcas
                  </h4>
                  <p>
                    Detecta las marcas de agua y las borra solo. Podés retocar cualquier máscara con el pincel interactivo antes de procesar el lote completo.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-[#18181B] dark:text-[#FAFAFA] mb-1 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-accent" />
                    Mejora de Fotos
                  </h4>
                  <p>
                    Reconstruye detalles, líneas nítidas y texturas de fotos de baja resolución o comprimidas, con comparador interactivo antes/después.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold text-[#18181B] dark:text-[#FAFAFA] mb-1 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-accent" />
                    Aceleración de Hardware
                  </h4>
                  <p>
                    Estado actual: <strong className="text-accent">{hardware.isCapable ? "WebGPU Activa (Máxima velocidad)" : "WebAssembly SIMD (CPU local)"}</strong>. Todo corre 100% en tu dispositivo.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
