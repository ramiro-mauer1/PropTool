// Genera los íconos de la app instalable (PWA) a partir del logo de Plinth:
// la "P" blanca con el punto verde lima sobre el fondo oscuro de la app.
// Uso: node scripts/generate-app-icons.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BG = "#08090a";
const LIME = "#d4ff32";

// Misma "P" que PlinthBrand.tsx (coordenadas del logo original, 1024×1024).
const P_PATH =
  "M1440 5211 l0 -841 235 0 235 0 0 220 0 220 193 0 c203 0 328 14 427 48 224 77 364 232 405 446 19 98 19 154 0 253 -22 116 -65 195 -154 283 -101 101 -219 160 -378 191 -34 6 -241 13 -510 16 l-453 5 0 -841z m797 459 c165 -21 243 -115 230 -276 -6 -82 -41 -137 -107 -171 -65 -33 -134 -43 -301 -43 l-149 0 0 243 c0 134 3 247 7 250 10 10 237 8 320 -3z";

// Caja de la "P" + punto en coordenadas del logo: x 144–336, y 394–588.
const MARK = { cx: 240, cy: 491, h: 194 };

/** `fill` = alto del logo como fracción del lado del ícono. */
function svg(fill) {
  const s = (1024 * fill) / MARK.h;
  const tx = 512 - MARK.cx * s;
  const ty = 512 - MARK.cy * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${BG}"/>
  <g transform="translate(${tx} ${ty}) scale(${s})">
    <g transform="translate(0,1024) scale(0.1,-0.1)"><path d="${P_PATH}" fill="#ffffff"/></g>
    <circle cx="309" cy="561" r="27.25" fill="${LIME}"/>
  </g>
</svg>`;
}

const icons = [
  // Íconos comunes: el logo ocupa ~56% del alto.
  { file: "public/icons/icon-192.png", size: 192, fill: 0.56 },
  { file: "public/icons/icon-512.png", size: 512, fill: 0.56 },
  // Maskable (Android): Android recorta el ícono en círculo/gota, así que el
  // logo tiene que quedar dentro de la zona segura (círculo del 80% central).
  { file: "public/icons/icon-maskable-512.png", size: 512, fill: 0.44 },
  // iPhone: iOS redondea las esquinas solo y no admite transparencia.
  { file: "src/app/apple-icon.png", size: 180, fill: 0.56 },
];

for (const { file, size, fill } of icons) {
  await sharp(Buffer.from(svg(fill)), { density: 300 })
    .resize(size, size)
    .flatten({ background: BG })
    .png()
    .toFile(path.join(root, file));
  console.log(`${file} (${size}×${size})`);
}
