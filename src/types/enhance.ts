export type EnhanceStatus =
  | "idle"
  | "queued"
  | "processing"
  | "completed"
  | "error";

export interface TileCoordinates {
  /** Posición X de inicio en la imagen de entrada original */
  srcX: number;
  /** Posición Y de inicio en la imagen de entrada original */
  srcY: number;
  /** Ancho del tile de entrada (256 px o menor en bordes residuales) */
  srcWidth: number;
  /** Alto del tile de entrada (256 px o menor en bordes residuales) */
  srcHeight: number;
  /** Posición X en el lienzo de salida escalado 4x */
  destX: number;
  /** Posición Y en el lienzo de salida escalado 4x */
  destY: number;
  /** Ancho del tile en la salida escalada (1024 px o menor) */
  destWidth: number;
  /** Alto del tile en la salida escalada (1024 px o menor) */
  destHeight: number;
  /** Indica si tiene solapamiento con un tile a la izquierda */
  hasLeftOverlap: boolean;
  /** Indica si tiene solapamiento con un tile a la derecha */
  hasRightOverlap: boolean;
  /** Indica si tiene solapamiento con un tile arriba */
  hasTopOverlap: boolean;
  /** Indica si tiene solapamiento con un tile abajo */
  hasBottomOverlap: boolean;
}

export interface TileProgressInfo {
  current: number;
  total: number;
  percentage: number;
  stage?: string;
}

export interface EnhanceQueueItem {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  targetWidth?: number;
  targetHeight?: number;
  isOptimized2K?: boolean;
  fileSizeKB: number;
  status: EnhanceStatus;
  tileProgress: TileProgressInfo;
  upscaledUrl?: string;
  upscaledBlob?: Blob;
  upscaledWidth?: number;
  upscaledHeight?: number;
  error?: string;
}

export type UpscaleWorkerCommand =
  | {
      type: "START_UPSCALE";
      payload: {
        imageId: string;
        file: File;
      };
    }
  | {
      type: "WARMUP_MODEL";
    }
  | {
      type: "CANCEL";
      payload?: {
        imageId: string;
      };
    };

export type UpscaleWorkerResponse =
  | {
      type: "MODEL_LOADED";
    }
  | {
      type: "STAGE_UPDATE";
      payload: {
        imageId: string;
        stage: string;
      };
    }
  | {
      type: "PROGRESS";
      payload: {
        imageId: string;
        tileIndex: number;
        totalTiles: number;
        percentage: number;
        stage?: string;
      };
    }
  | {
      type: "IMAGE_COMPLETED";
      payload: {
        imageId: string;
        upscaledBlob: Blob;
        upscaledWidth: number;
        upscaledHeight: number;
        originalWidth: number;
        originalHeight: number;
      };
    }
  | {
      type: "ERROR";
      payload: {
        imageId?: string;
        error: string;
      };
    }
  | {
      type: "CANCELLED";
      payload: {
        imageId: string;
      };
    };
