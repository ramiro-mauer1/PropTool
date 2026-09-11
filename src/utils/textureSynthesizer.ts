/**
 * TextureSynthesizer (Procedural Film Grain)
 * 
 * Elimina el aspecto "plástico" de las redes GAN inyectando grano fotográfico
 * sintético de alta resolución. Modula la intensidad basándose en la luminancia
 * (más fuerte en tonos medios, desaparece en sombras/luces extremas) para un look natural.
 */
export class TextureSynthesizer {
    constructor(maxTileWidth: number, maxTileHeight: number) {
        // Ya no necesitamos pre-alojar buffers gigantes!
        // El grano procedural se genera al vuelo, ahorrando muchísima memoria.
    }

    // La extracción ya no es necesaria, dejamos el método vacío para no romper tu worker
    public extractHighFrequency(originalTile: Float32Array, width: number, height: number): void {
        // No-op
    }

    /**
     * Inyecta grano procedural de alta resolución directamente en el tensor de salida.
     */
    public injectAndScale(
        onnxOutput: Float32Array, 
        origW: number,
        origH: number,
        scale: number = 4, 
        strength: number = 0.08, // 0.08 es un excelente valor para grano fílmico natural
        minVal: number = 0.0,
        maxVal: number = 1.0
    ): void {
        const outW = origW * scale;
        const outH = origH * scale;
        const channelSize = outW * outH;
        
        const offsetR = 0;
        const offsetG = channelSize;
        const offsetB = 2 * channelSize;

        for (let i = 0; i < channelSize; i++) {
            const r = onnxOutput[offsetR + i];
            const g = onnxOutput[offsetG + i];
            const b = onnxOutput[offsetB + i];
            
            // 1. Calcular Luminancia del píxel (0.0 a 1.0)
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            
            // 2. Curva de atenuación (Midtone emphasis)
            // El grano real de la película es más prominente en los tonos medios (gris 50%)
            // y desaparece en los blancos puros y negros puros.
            // Una parábola simple: 4 * x * (1 - x) da 1.0 en el medio y 0.0 en los extremos.
            const lumaCurve = 4.0 * luma * (1.0 - luma);
            
            // 3. Generar ruido blanco (-1.0 a 1.0)
            const noise = (Math.random() * 2.0 - 1.0);
            
            // 4. Calcular el valor final del grano a inyectar
            const grainVal = noise * lumaCurve * strength;
            
            // 5. Inyectar grano neutral en RGB y aplicar Clamp estricto
            let nr = r + grainVal;
            let ng = g + grainVal;
            let nb = b + grainVal;
            
            if (nr < minVal) nr = minVal; else if (nr > maxVal) nr = maxVal;
            if (ng < minVal) ng = minVal; else if (ng > maxVal) ng = maxVal;
            if (nb < minVal) nb = minVal; else if (nb > maxVal) nb = maxVal;
            
            onnxOutput[offsetR + i] = nr;
            onnxOutput[offsetG + i] = ng;
            onnxOutput[offsetB + i] = nb;
        }
    }
}
