# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Corredores inmobiliarios independientes y equipos chicos de zona oeste del GBA y Pilar. El acceso es solo por invitación (`AllowedEmail`). Usan Plinth mucho desde el teléfono, entre visitas y en la calle, como PWA. Su trabajo es captar propiedades, mantener el seguimiento de cada cliente o dueño, y preparar las fotos para publicar.

## Product Purpose

Plinth es la herramienta de trabajo diaria del corredor. Junta en un solo lugar la edición de fotos (limpieza de marcas de agua, mejora 4x), la prospección (Buscador, Captaciones) y el seguimiento de clientes (Cartera Inteligente). El éxito se mide en propiedades captadas y en seguimientos que no se pierden.

## Positioning

En Plinth, seguir y controlar lo que se le manda a cada cliente tiene mucha menos fricción que en un CRM tradicional. El corredor cuenta lo que pasó en lenguaje natural, por texto o por voz, confirma, y la app arma el registro, la tarea y el mensaje sugerido. En Captaciones, cada oportunidad ya llega con el motivo, el contacto y un borrador de mensaje listo para mandar.

## Operating Context

- Se usa en el teléfono, con una mano y apurado; también en escritorio para trabajar en lote.
- Los mensajes salen por WhatsApp (`wa.me`), que es el canal principal con dueños y clientes.
- Portales de origen: Zonaprop, Argenprop y MercadoLibre.
- Un buscador externo corre una vez por semana y carga captaciones de dueños directos.

## Capabilities and Constraints

- Next.js 14 + Prisma sobre Supabase. Login por invitación.
- El procesamiento de fotos corre 100% en el navegador, con ONNX/WASM, y las fotos no salen del dispositivo.
- Todo lo que cuesta plata (por ejemplo, comprar el teléfono de un aviso vía Apify) se hace solo cuando el corredor lo pide, siempre con confirmación y mostrando el costo.
- Los textos que vienen de avisos de terceros se tratan como datos y se muestran como texto plano.
- Interfaz en español rioplatense, con voseo, en tema oscuro y claro.

## Brand Commitments

- Nombre: Plinth. Logo en `PlinthBrand.tsx` y `Plinth.svg`.
- Design system Jota Studio: fondo oscuro `#09090b`, acento `#d4ff32`, tipografía Geist, sobrio y profesional.
- Sin emojis en la UI, sin gradientes de colores nuevos, sin sombras pesadas.

## Evidence on Hand

- Muestra real de captaciones en `plinth_muestra_captaciones.json`: la corrida del 5/10/2026, con 14 captaciones.
- No hay testimonios, clientes ni métricas publicables. No hay que inventarlos.

## Product Principles

1. Menos fricción que un CRM: cada pantalla lleva al próximo mensaje o a la próxima acción en uno o dos toques.
2. El corredor confirma, Plinth propone: nada se guarda, se manda ni se cobra sin una acción explícita.
3. Pensado primero para el teléfono: áreas táctiles de 44 px y lectura de un vistazo.
4. Cada oportunidad explica por qué vale la pena.
