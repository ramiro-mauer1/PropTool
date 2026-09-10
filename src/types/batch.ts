export interface WatermarkBBox {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth?: number;
  imageHeight?: number;
}

export interface BatchImage {
  id: string;
  file: File;
  previewUrl: string;
  mockMask?: WatermarkBBox;
  maskData?: ImageData;
  autoMaskBBox?: WatermarkBBox;
  isRetouching?: boolean;
  /** Dimensiones nativas de la imagen */
  naturalWidth?: number;
  naturalHeight?: number;
  /** Tamaño del archivo en KB */
  fileSizeKB?: number;
  /** true si la imagen tiene resolución o calidad muy baja */
  isLowQuality?: boolean;
}
