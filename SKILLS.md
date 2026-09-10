# Catálogo y Guía Completa de Skills - JotaTool v2

> **Documento maestro de referencia sobre las skills de inteligencia artificial, diseño y desarrollo disponibles en el entorno de JotaTool v2, junto con las capacidades técnicas del software.**

---

## 1. ¿Qué son las Skills en el Ecosistema Antigravity?

Las **skills** son extensiones modulares de capacidades e instrucciones especializadas que dotan al agente de IA de criterios avanzados, reglas de ingeniería, conocimientos de diseño de alto nivel y protocolos de ejecución técnica. Cada skill se define mediante una carpeta con un archivo `SKILL.md` estructurado con metadatos YAML y directrices operativas.

En el entorno de **JotaTool v2**, disponemos de:
- **15 Skills Premium de Diseño, Frontend e Ingeniería (`jota-premium-skills`)**: Diseñadas específicamente para crear interfaces sin patrones genéricos ("anti-slop"), con estándares de agencias de diseño de primer nivel, control estricto de generación de código y refinamiento visual.
- **5 Skills del Sistema Antigravity (`builtin`)**: Herramientas nativas para la orquestación del IDE, generación de UI interactiva, automatización y personalización.
- **5 Capacidades Técnicas Core (Skills de JotaTool como Software)**: Los módulos y algoritmos que dan vida a la plataforma de edición inmobiliaria.

---

## 2. Skills Premium de Diseño y Desarrollo (`jota-premium-skills`)

---

### 1. `design-taste-frontend`
* **Tipo:** Sistema de Diseño Frontend & Anti-Slop (Versión 2).
* **Propósito:** Previene que las interfaces generadas por IA parezcan plantillas genéricas o predecibles (gradientes morados estridentes, tarjetas idénticas, mallas oscuras estándar, etc.).
* **Mecanismos Clave:**
  - **Inferencia de Brief ("Read the Room"):** Antes de generar código, el modelo analiza el tipo de sitio, la audiencia, el tono deseado y formula una declaración de estilo de una sola línea.
  - **Los Tres Controles (The Three Dials):**
    - `DESIGN_VARIANCE` (1 a 10): Nivel de asimetría o creatividad en el diseño.
    - `MOTION_INTENSITY` (1 a 10): Magnitud del movimiento (desde estático hasta cinemático).
    - `VISUAL_DENSITY` (1 a 10): Espaciado de información (desde galería espaciosa hasta cabina de avión).
  - **Disciplina Anti-Default:** Prohíbe deliberadamente paletas `slate-900 + violet-500` con `Inter` como fuente predeterminada.

---

### 2. `design-taste-frontend-v1`
* **Tipo:** Compatibilidad y Estilo Original (v1).
* **Propósito:** Preserva la versión clásica del motor de diseño para proyectos que requieren estabilidad visual sin adoptar las reglas experimentales de la v2.
* **Cuándo se usa:** Solo cuando se requiere consistencia milimétrica con componentes construidos bajo la primera especificación de la skill.

---

### 3. `emil-design-eng`
* **Tipo:** Filosofía de Ingeniería de Diseño y Microinteracciones.
* **Propósito:** Codifica la filosofía y técnicas de Emil Kowalski sobre el pulido de interfaces, física de resortes (*spring animations*), microinteracciones y los detalles "invisibles" que diferencian una aplicación común de una extraordinaria.
* **Mecanismos Clave:**
  - Animaciones basadas en masa y tensión en lugar de curvas bézier lineales o predecibles.
  - Respuesta táctil inmediata al interactuar con botones o controles (efecto *depress* y *release* calibrado).
  - Evitar animaciones intrusivas o molestas que entorpezcan la velocidad de uso del usuario.

---

### 4. `impeccable`
* **Tipo:** Auditoría, Refinamiento y Hardening de UI/UX.
* **Propósito:** Actúa como un revisor de diseño sénior para pulir, clarificar, ordenar y optimizar interfaces existentes (paneles de control, formularios, carruseles, barras de navegación).
* **Mecanismos Clave:**
  - **Jerarquía y Carga Cognitiva:** Reduce el ruido visual destacando únicamente la acción principal por vista.
  - **Accesibilidad y Ergonomía:** Garantiza contrastes cromáticos legibles, navegación lógica por teclado y estados de foco visibles.
  - **Tratamiento de Estados Edge:** Diseña estados de carga (*skeleton*), estados vacíos (*empty states*), estados de error y confirmaciones de éxito con gracia.

---

### 5. `high-end-visual-design`
* **Tipo:** Estética de Agencia de Lujo y Software de Alto Valor.
* **Propósito:** Enseña al agente a estructurar interfaces con el aspecto de marcas de tecnología de élite (Apple, Linear, Teenage Engineering).
* **Mecanismos Clave:**
  - **Superficies y Sombras:** Uso de dobles biseles (*double-bezel*), sombras profundas y difusas con dispersión amplia (`box-shadow: 0 16px 36px -10px rgba(0,0,0,0.7)`), y fondos que combinan desenfoque de fondo (*backdrop-filter*) con saturación calibrada.
  - **Bordes de Precisión:** Bordes oscuros translúcidos (`rgba(255,255,255,0.08)`) en lugar de líneas blancas sólidas o duras.
  - **Tipografía Editorial:** Balance entre tipografías de palo seco ultra legibles y titulares con personalidad formal.

---

### 6. `minimalist-ui`
* **Tipo:** Minimalismo Editorial & Organización Limpia.
* **Propósito:** Diseña interfaces limpias, tranquilas y elegantes basadas en monocromía cálida y contraste tipográfico, erradicando gradientes sobrecargados o sombras pesadas.
* **Mecanismos Clave:**
  - Cuadrículas bento planas y limpias.
  - Colores tenues y acentos puntuales.
  - Espaciado generoso que permite que el contenido respire sin saturación de elementos.

---

### 7. `industrial-brutalist-ui`
* **Tipo:** Brutalismo Industrial & Estética Utilitaria Suiza.
* **Propósito:** Crea interfaces mecánicas inspiradas en terminales técnicas, esquemas de patentes de ingeniería y diseño tipográfico suizo estricto.
* **Mecanismos Clave:**
  - Cuadrículas rígidas y geométricas con líneas visibles.
  - Fuentes monoespaciadas para parámetros técnicos.
  - Paletas de alto contraste y aspecto analógico deliberado.

---

### 8. `gpt-taste`
* **Tipo:** Dirección de UX/UI y Movimiento Avanzado con GSAP.
* **Propósito:** Diseña páginas estructuradas bajo el modelo persuasivo AIDA (Atención, Interés, Deseo, Acción) integrando la librería de animación GSAP y ScrollTrigger.
* **Mecanismos Clave:**
  - Secciones apiladas con efecto de fijado (*pinning*) y barrido (*scrubbing*).
  - Tipografía horizontal amplia para evitar roturas de línea prematuras.
  - Bento grids continuos sin espacios muertos.

---

### 9. `image-to-code`
* **Tipo:** Traducción Fiel de Diseños e Imágenes a Código.
* **Propósito:** Convierte referencias visuales, bocetos o capturas de pantalla en código HTML/Tailwind/React con máxima fidelidad visual y estructural.
* **Mecanismos Clave:**
  - Análisis sección por sección en lugar de aproximaciones vagas globales.
  - Detección precisa de proporciones de espaciado (padding, gap, margins).
  - Recreación estricta de jerarquías tipográficas y componentes interactivos.

---

### 10. `imagegen-frontend-web`
* **Tipo:** Dirección de Arte y Generación de Referencias Web.
* **Propósito:** Genera imágenes conceptuales de alta calidad para cada sección individual de un sitio web antes de escribir el código fuente.
* **Mecanismos Clave:**
  - Regla estricta de una imagen horizontal por cada sección del sitio (nunca comprimir varias secciones en un solo fotograma).
  - Asegura coherencia de paleta de colores y narrativa a lo largo de todas las vistas generadas.

---

### 11. `imagegen-frontend-mobile`
* **Tipo:** Generación de Conceptos y Pantallas Móviles Nativas.
* **Propósito:** Crea imágenes de referencia para aplicaciones móviles (iOS, Android) integradas en marcos sutiles de smartphones de última generación.
* **Mecanismos Clave:**
  - Composición orientada a interfaces táctiles (navegación inferior, headers adaptativos).
  - Jerarquía clara optimizada para pantallas pequeñas.

---

### 12. `brandkit`
* **Tipo:** Creación de Identidad y Sistemas de Marca.
* **Propósito:** Genera pautas completas de marca, tableros de identidad (*brand guidelines*), sistemas de logotipos y decks conceptuales.
* **Mecanismos Clave:**
  - Optimizado para estilos tecnológicos oscuros, lujo minimalista y herramientas de desarrollo.
  - Define reglas cromáticas, símbolos distintivos y maquetas de producto coherentes.

---

### 13. `redesign-existing-projects`
* **Tipo:** Auditoría y Modernización de Proyectos Heredados.
* **Propósito:** Toma bases de código existentes y las eleva a estándares de diseño premium sin romper la lógica de negocio ni dependencias previas.
* **Mecanismos Clave:**
  - Auditoría de patrones visuales pobres o genéricos.
  - Reemplazo gradual de tokens CSS y componentes respetando la funcionalidad instalada.

---

### 14. `stitch-design-taste`
* **Tipo:** Generación Semántica de Tokens para Google Stitch.
* **Propósito:** Produce archivos `DESIGN.md` estructurados y amigables para agentes de IA, estableciendo tokens universales de color, tipografía y movimiento acelerado por hardware.

---

### 15. `full-output-enforcement`
* **Tipo:** Control y Exhaustividad de Salida de Código.
* **Propósito:** Anula el comportamiento predeterminado de los modelos de lenguaje de truncar código largo o colocar comentarios perezosos como `// ... resto del código`.
* **Mecanismos Clave:**
  - Prohíbe estrictamente marcadores de posición (`TODO`, `// keep same`, `...`).
  - Fuerza la entrega de implementaciones completas, listas para producción y sin fragmentación.

---

## 3. Skills del Sistema Antigravity / Builtin

---

### 16. `antigravity-guide`
* **Tipo:** Documentación Maestra del Ecosistema Google Antigravity (AGY).
* **Propósito:** Proporciona guía exhaustiva sobre la arquitectura de Antigravity 2.0, comandos slash (`/goal`, `/boost`, `/schedule`), atajos de teclado, SDK en Python y el ciclo de vida del agente.

---

### 17. `agy-customizations`
* **Tipo:** Sistema de Personalización y Extensibilidad.
* **Propósito:** Guía y gestiona la creación de nuevas skills, reglas de comportamiento (`rules`), plugins, hooks del sistema y servidores de protocolo MCP (*Model Context Protocol*).

---

### 18. `generative_ui`
* **Tipo:** Renderizado de Interfaces Enriquecidas en Chat y Artefactos.
* **Propósito:** Permite al agente crear widgets interactivos en HTML/JS, diagramas dinámicos de datos y controles interactivos presentados directamente al usuario.

---

### 19. `android-cli`
* **Tipo:** Automatización y Desarrollo Android.
* **Propósito:** Permite compilar proyectos, ejecutar emuladores (AVD), tomar capturas de pantalla, inspeccionar la jerarquía visual de apps móviles e instalar SDKs.

---

### 20. `migrate-workflows`
* **Tipo:** Migración de Flujos de Trabajo Legados.
* **Propósito:** Escanea configuraciones antiguas y las transforma de manera segura al estándar moderno de especificación `SKILL.md`.

---

## 4. Capacidades Técnicas Core de JotaTool v2 (Skills del Software)

Además de las skills del agente de desarrollo, **JotaTool v2** cuenta con habilidades técnicas propietarias integradas en su arquitectura:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CAPACIDADES TÉCNICAS DE JOTATOOL v2                      │
├───────────────────────┬─────────────────────────────────────────────────────┤
│ 1. Watermark Removal  │ Inpainting neuronal con LaMa cuantizado y capas FFC │
│ 2. Text Detection     │ Autolocalización de marcas con red DBNet en ONNX    │
│ 3. Super-Resolution   │ Escalado 4x de alta nitidez con Real-ESRGAN Compact │
│ 4. Tiled Processing   │ Particionado con solapamiento y costura gaussiana   │
│ 5. Client-Side Edge   │ Inferencia 100% en WebAssembly multihilo sin nube   │
└───────────────────────┴─────────────────────────────────────────────────────┘
```

1. **Watermark Inpainting (Eliminación de Marcas):** Reconstrucción fotorealista de zonas ocultas tras logotipos, sellos de inmobiliarias y firmas fotográficas.
2. **Watermark Auto-Detection (Detección Automática):** Reconocimiento instantáneo de cajas delimitadoras con texto o marcas al arrastrar las imágenes.
3. **Super-Resolution 4x (Super-Resolución):** Cuadruplicación de resolución con regeneración de bordes nítidos para fotos pequeñas o pixeladas.
4. **Tiled Memory Pipeline (Procesamiento por Teselas):** Capacidad de procesar fotos de 4K, 8K o más sin agotar la memoria del navegador dividiéndolas en bloques con mezcla gaussiana suave.
5. **Local Processing Engine (Privacidad Absoluta):** Toda la computación ocurre en la máquina del cliente, garantizando confidencialidad total de las propiedades inmobiliarias.
