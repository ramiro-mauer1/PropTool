import { Tensor } from "onnxruntime-web";

/**
 * Convierte un objeto ImageData de Canvas a un tensor ONNX de tipo Float32.
 * El formato de salida es NCHW (1, 3, height, width).
 * Normaliza los valores RGB de [0, 255] a [0.0, 1.0].
 */
export function imageToTensor(imageData: ImageData): Tensor {
  const { data, width, height } = imageData;
  const floatData = new Float32Array(3 * width * height);

  for (let i = 0; i < width * height; i++) {
    // Normalizacion estandar [0, 1]
    floatData[i] = data[i * 4] / 255.0; // Canal R
    floatData[width * height + i] = data[i * 4 + 1] / 255.0; // Canal G
    floatData[2 * width * height + i] = data[i * 4 + 2] / 255.0; // Canal B
  }

  return new Tensor("float32", floatData, [1, 3, height, width]);
}

/**
 * Convierte un objeto ImageData de la mascara a un tensor ONNX de tipo Float32.
 * El formato de salida es NCHW (1, 1, height, width).
 * Asume que el color blanco representa el area a borrar (1.0) y negro es el fondo (0.0).
 */
export function maskToTensor(maskData: ImageData): Tensor {
  const { data, width, height } = maskData;
  const floatData = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    // Usamos el canal R de la mascara. Si es mayor a 127, es 1.0 (mask), sino 0.0.
    floatData[i] = data[i * 4] > 127 ? 1.0 : 0.0;
  }

  return new Tensor("float32", floatData, [1, 1, height, width]);
}

/**
 * Convierte el tensor de salida del modelo ONNX (NCHW) a un objeto ImageData estándar de RGBA.
 * Detecta automáticamente si los valores están en rango [0, 1] o [0, 255]
 * usando muestreo estadístico robusto (percentil 99 sobre una muestra amplia).
 */
export function tensorToImageData(
  tensor: Tensor,
  width: number,
  height: number
): ImageData {
  const data = tensor.data as Float32Array;
  const clampedData = new Uint8ClampedArray(4 * width * height);

  // ═══════════════════════════════════════════════════════════════════
  // Detección de rango ROBUSTA: muestrear ~1000 valores distribuidos
  // uniformemente por todo el tensor y calcular el percentil 99.
  // Esto evita el bug de confiar en un solo pixel oscuro para decidir
  // si el output es [0,1] o [0,255].
  // ═══════════════════════════════════════════════════════════════════
  const totalElements = data.length;
  const sampleCount = Math.min(1000, totalElements);
  const step = Math.max(1, Math.floor(totalElements / sampleCount));
  const samples: number[] = [];

  for (let i = 0; i < totalElements; i += step) {
    samples.push(Math.abs(data[i]));
  }

  samples.sort((a, b) => a - b);
  const p99Index = Math.min(samples.length - 1, Math.floor(samples.length * 0.99));
  const p99 = samples[p99Index];

  // Si el percentil 99 es > 2.0, los valores están en rango [0, 255]
  // Si el percentil 99 es <= 2.0, los valores están en rango [0, 1]
  const multiplier = p99 > 2.0 ? 1.0 : 255.0;

  for (let i = 0; i < width * height; i++) {
    const r = data[i] * multiplier;
    const g = data[width * height + i] * multiplier;
    const b = data[2 * width * height + i] * multiplier;

    clampedData[i * 4] = Math.max(0, Math.min(255, Math.round(r))); // R
    clampedData[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(g))); // G
    clampedData[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(b))); // B
    clampedData[i * 4 + 3] = 255; // Alpha fijo en opaco
  }

  return new ImageData(clampedData, width, height);
}
