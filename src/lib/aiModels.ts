/**
 * Modelos ONNX que corren en el navegador. Los chicos viajan con la app en
 * public/models/ (ver .gitignore).
 */
export const UPSCALE_MODEL_URL = "/models/realesr-general-x4v3.onnx";
export const TEXT_DET_MODEL_URL = "/models/text_det.onnx";

/**
 * LaMa (Limpieza) pesa ~208 MB: supera el límite de 100 MB por archivo de
 * GitHub, así que no se publica con la app. Hasta alojarlo afuera, en
 * producción esta ruta da 404 y Limpieza se muestra como "todavía no
 * disponible". Si pasa a otro host, sumarlo a connect-src en middleware.ts
 * (y ese host tiene que responder con CORS, por el COEP require-corp).
 */
export const LAMA_MODEL_URL = "/models/lama_quantized.onnx";

export const CLEANUP_UNAVAILABLE_TITLE = "Esta función todavía no está disponible";
export const CLEANUP_UNAVAILABLE_MESSAGE =
  "Estamos terminando de preparar la limpieza de marcas de agua. Mientras tanto, podés usar Mejora de Fotos.";

let lamaAvailable: Promise<boolean> | null = null;

/** ¿Está publicado el modelo de Limpieza? Pregunta una sola vez por carga de página. */
export function isLamaModelAvailable(): Promise<boolean> {
  lamaAvailable ??= fetch(LAMA_MODEL_URL, { method: "HEAD" })
    .then((res) => res.ok)
    .catch((err) => {
      // Falla de red, no ausencia del modelo: volver a preguntar la próxima vez.
      console.warn("[aiModels] No se pudo comprobar el modelo de Limpieza:", err);
      lamaAvailable = null;
      return false;
    });
  return lamaAvailable;
}
