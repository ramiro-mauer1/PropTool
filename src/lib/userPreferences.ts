/**
 * Preferencias de la cuenta (no del dispositivo): viajan con el usuario porque
 * viven en `user_metadata` de Supabase Auth. Compartido entre cliente y servidor.
 */

export const MESSAGE_TONES = ['cercano', 'formal'] as const;
export type MessageTone = (typeof MESSAGE_TONES)[number];

export const START_MODULES = ['captaciones', 'crm', 'inpainting', 'enhance'] as const;
export type StartModule = (typeof START_MODULES)[number];

export const START_MODULE_LABELS: Record<StartModule, string> = {
  captaciones: 'Captaciones',
  crm: 'Cartera Inteligente',
  inpainting: 'Limpieza Inteligente',
  enhance: 'Mejora de Fotos',
};

export const MESSAGE_TONE_LABELS: Record<MessageTone, { label: string; example: string }> = {
  cercano: { label: 'Cercano', example: '¡Hola Laura! ¿Cómo andás? Te escribo por el depto de Palermo…' },
  formal: { label: 'Formal', example: 'Buenos días, Laura. Me comunico con usted por el departamento de Palermo…' },
};

export function isMessageTone(v: unknown): v is MessageTone {
  return typeof v === 'string' && (MESSAGE_TONES as readonly string[]).includes(v);
}

export function isStartModule(v: unknown): v is StartModule {
  return typeof v === 'string' && (START_MODULES as readonly string[]).includes(v);
}

export function messageToneFromMetadata(metadata: Record<string, unknown> | undefined): MessageTone {
  return isMessageTone(metadata?.message_tone) ? metadata.message_tone : 'cercano';
}
