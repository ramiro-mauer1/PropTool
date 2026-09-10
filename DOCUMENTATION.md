# JotaTool v2 - Documentación de Arquitectura, Estética y Funcionalidades

> **Suite Profesional de Edición e Inteligencia Artificial Local para Fotografía Inmobiliaria.**

---

## 1. Arquitectura Actual del Sistema

JotaTool v2 está diseñado bajo el paradigma **Client-Side Edge AI**. A diferencia de las soluciones SaaS convencionales que envían las fotografías a servidores remotos para su procesamiento, JotaTool ejecuta todos los modelos de redes neuronales directamente en el navegador del cliente mediante WebAssembly multihilo y aceleración de hardware local.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             NAVEGADOR DEL CLIENTE                           │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               HILO PRINCIPAL (Next.js / React 18 / UI)                │  │
│  │  - Gestión de Estado (Batch & Queue Hooks)                            │  │
│  │  - Lienzo Interactivo y Comparador Antes/Después                      │  │
│  │  - Bento Grid & Navegación por Atajos                                 │  │
│  └─────────────────┬───────────────────────────────────┬─────────────────┘  │
│                    │                                   │                    │
│         postMessage│ (Transferable Blobs)   postMessage│ (Tile Coordinates) │
│                    ▼                                   ▼                    │
│  ┌──────────────────────────────────┐ ┌──────────────────────────────────┐  │
│  │   AI Worker (ai.worker.ts)       │ │   Upscale Worker (upscale.worker)│  │
│  │  - textDetector (DBNet ONNX)     │ │  - Real-ESRGAN Compact ONNX      │  │
│  │  - LaMa Inpainting Quantized     │ │  - Tiled Processor (Overlap/Pad) │  │
│  │  - Dynamic Patching & Stitching  │ │  - Gaussian Blending Accumulator │  │
│  │  - ONNX Runtime WASM Multihilo   │ │  - ONNX Runtime WASM Multihilo   │  │
│  └──────────────────────────────────┘ └──────────────────────────────────┘  │
│                                                                             │
│  100% Local • Sin Backend de Procesamiento • Sin Salida de Datos a la Nube │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1. Stack Tecnológico Base
- **Framework:** [Next.js 14](https://nextjs.org/) (App Router, compilación optimizada, soporte SSR y empaquetado de assets estáticos).
- **Librería de UI:** [React 18](https://react.dev/) con arquitectura de hooks desacoplados.
- **Tipado:** [TypeScript 5](https://www.typescriptlang.org/) estricto en todos los módulos, tipos de tensores y eventos de workers.
- **Motor de Inferencia:** [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) (`onnxruntime-web` v1.29.0) con soporte para WASM SIMD con multithreading.
- **Estilos y Componentes:** [Tailwind CSS](https://tailwindcss.com/) v3.4, `tailwind-merge`, `clsx` y [Lucide React](https://lucide.dev/) para iconografía SVG consistente.
- **Empaquetado y Descargas:** [JSZip](https://stuk.github.io/jszip/) para la compresión y descarga en bloque de lotes procesados.

### 1.2. Modelos de Redes Neuronales Integrados
Los modelos se alojan de forma estática en la carpeta pública (`/public/models/`), permitiendo su descarga bajo demanda con caché local del navegador:

1. **Detección Automática de Marcas (`text_det.onnx` ~2.4 MB):**
   - Basado en arquitectura DBNet (Differentiable Binarization).
   - Analiza la imagen buscando firmas, textos, sellos y marcas de agua de inmobiliarias en las esquinas o en el centro.
   - Genera automáticamente coordenadas de bounding box y máscaras binarias iniciales.

2. **Inpainting con LaMa Cuantizado (`lama_quantized.onnx` ~208 MB):**
   - Modelo Large Mask Inpainting con capas FFC (Fast Fourier Convolutions) cuantizadas para alta velocidad en CPU.
   - Reconstruye de manera fotorealista las texturas de pisos, paredes, cielos y mobiliario ocultos tras logotipos o textos.

3. **Super-Resolución con Real-ESRGAN Compact (`realesr-general-x4v3.onnx` ~4.8 MB):**
   - Red neuronal compacta optimizada para restaurar detalles finos, eliminar artefactos de compresión JPEG y cuadruplicar la resolución efectiva de las imágenes.

### 1.3. Pipeline de Memoria y Procesamiento por Teselas (Tiling)
Las fotos de propiedades inmobiliarias suelen tener resoluciones altas (3000x2000 px o superior). Ejecutar redes convolucionales completas sobre estas dimensiones saturaría la memoria del navegador. Para solucionar esto, JotaTool v2 implementa:
- **Tiling & Stitching Inteligente:** La imagen se subdivide en parches cuadrados con solapamiento (overlap padding).
- **Máscara de Fusión Ponderada (Gaussian Weight Mask):** En la reconstrucción, los bordes de cada tesela se combinan usando un degradado de pesos para evitar costuras visibles o líneas de corte en la fotografía final.
- **Aislamiento en Web Workers:** La inferencia ocurre en hilos independientes (`ai.worker.ts` y `upscale.worker.ts`), permitiendo que la interfaz permanezca fluida a 60–120 FPS sin bloqueos ni caídas de fotogramas.
- **Gestión Estricta de Memoria:** Liberación explícita de tensores ONNX (`tensor.dispose()`), cierre de bitmaps (`bitmap.close()`) y revocación inmediata de URLs temporales con `URL.revokeObjectURL()`.

---

## 2. Estética y Filosofía de Diseño

JotaTool v2 abandona el aspecto de las herramientas genéricas de IA saturadas de efectos distractores para adoptar una **estética de estudio profesional y sobria**, orientada a profesionales y agencias del sector inmobiliario.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DESIGN SYSTEM: JOTA STUDIO                      │
├────────────────────────────────────────────────────────────────────────┤
│ Fondo Base       │ #09090b (Zinc 950 profundo, mate, antirreflejo)    │
│ Superficies      │ #131316 / #1a1a1f (Doble bisel con blur de 16px)   │
│ Bordes           │ #24242b / rgba(255, 255, 255, 0.08)                │
│ Acento Primario  │ #f59e0b (Ámbar cálido, sobrio, alta visibilidad)    │
│ Confirmación     │ #10b981 (Esmeralda para fotos limpias y éxito)      │
│ Tipografía       │ Geist Sans & Geist Mono (Vercel)                    │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Principios Visuales Clave
- **Sin Animaciones Innecesarias:** Se eliminaron bucles infinitos, barridos de escáner y fondos animados de alta carga de GPU. El espacio de trabajo es estático, enfocado en el contenido visual del usuario.
- **Sin Sobrecarga Técnica:** Se eliminaron métricas de latencia en milisegundos (`38ms`), contadores fraccionales crudos y terminología informática confusa. El lenguaje es directo, claro y centrado en el valor del negocio inmobiliario.
- **Microinteracciones Táctiles:** Botones y tarjetas reaccionan con transiciones suaves de color y escala táctil sutil (`btn-tactile`), brindando respuesta inmediata al clic sin retrasos perceptibles.
- **Bento Grid Estructurado:** La pantalla inicial organiza las herramientas principales en un mosaico equilibrado y moderno, facilitando el acceso directo a cada funcionalidad según la necesidad del agente.
- **Jerarquía Visual de Contraste Calibrado:** Texto blanco de alta legibilidad (`text-foreground`) sobre fondos oscuros no reflectantes, evitando la fatiga visual tras horas de edición continua.

---

## 3. Funcionalidades Actuales

JotaTool v2 integra dos flujos de trabajo especializados en una misma suite:

```
                  ┌───────────────────────────────┐
                  │      Carga de Fotografías     │
                  │   (Arrastrar o Seleccionar)   │
                  └──────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
     ┌───────────────────────┐       ┌───────────────────────┐
     │  MÓDULO DE INPAINTING │       │  MÓDULO DE SUPER-RES  │
     │  (Limpieza de Marcas) │       │   (Mejora de Calidad) │
     └───────────┬───────────┘       └───────────┬───────────┘
                 │                               │
                 │ Detección / Retoque           │ Restauración de Detalle
                 │ Eliminación de Logos          │ Escalado a Alta Def.
                 │                               │
                 └───────────────┬───────────────┘
                                 │ Transferencia Directa ("Enviar a 4x")
                                 ▼
                 ┌───────────────────────────────┐
                 │    Inspección Antes / Después │
                 │      y Descarga (Individual   │
                 │          o Lote Completo)     │
                 └───────────────────────────────┘
```

### 3.1. Módulo 1: Limpieza de Marcas y Logotipos (Inpainting)
- **Carga Múltiple por Lotes:** Permite arrastrar o seleccionar colecciones completas de fotos de propiedades (formatos JPEG, PNG, WebP).
- **Detección Automática:** Al ingresar cada fotografía, la red neuronal de detección localiza automáticamente marcas de agua o textos recurrentes (sellos de agencias, portales inmobiliarios, etc.).
- **Editor Manual de Máscara (Canvas Editor):**
  - Herramienta de pincel para añadir áreas a eliminar.
  - Herramienta de borrador de máscara para excluir zonas protegidas.
  - Regulador continuo de tamaño del trazo.
- **Procesamiento Asíncrono en Lote:**
  - Botón contextual de ejecución que procesa secuencialmente todas las fotos pendientes.
  - Barra de progreso que indica el estado del lote en tiempo real.
  - Opción de cancelación segura en cualquier momento sin perder las fotos ya terminadas.

### 3.2. Módulo 2: Visualizador y Carrusel de Inspección
- **Galería Circular Dinámica:** Muestra la fotografía central seleccionada en alta resolución acompañada por miniaturas de navegación.
- **Comparador Antes / Después:** Mecanismo para alternar o deslizar visualmente entre la imagen original con marca y el resultado restaurado.
- **Indicador de Fotos de Baja Calidad:** Etiqueta visual que detecta automáticamente imágenes con baja resolución o compresión excesiva y sugiere enviarlas al módulo de mejora.

### 3.3. Módulo 3: Mejora de Calidad y Definición (Super-Resolución)
- **Espacio de Trabajo Dedicado (`EnhanceWorkspace`):** Entorno exclusivo para la mejora de nitidez y ampliación de imagen.
- **Cola de Procesamiento (`EnhanceQueue`):** Sistema de turnos por imagen con estados claros (*En espera*, *Procesando*, *Listo*, *Error*).
- **Transferencia Intermodular Sin Fricción:**
  - Las fotos limpiadas en el módulo de inpainting se pueden transferir individualmente o en lote completo directamente a la cola de mejora mediante el botón **"Enviar a 4x"**.
  - Evita tener que descargar y volver a subir archivos manualmente.

### 3.4. Módulo 4: Exportación y Productividad
- **Descargas Individuales:** Guardado instantáneo con sufijo descriptivo (`_limpia.png`, `_mejorada.png`).
- **Descarga de Lote:** Guardado ordenado de todas las fotos limpiadas del lote actual con un solo clic.
- **Navegación Ergonómica por Teclado:**
  - `←` / `→` : Navegación rápida entre fotografías del lote.
  - `Espacio` : Alternar vista Antes / Después en tiempo real.
  - `B` / `E` : Selección rápida de Brocha o Goma en el lienzo de máscara.
- **Privacidad y Seguridad Garantizada:** Al no existir conexión con APIs de terceros, las fotografías privadas de propiedades nunca salen del equipo del usuario, cumpliendo con las políticas más exigentes de confidencialidad y protección de datos.
