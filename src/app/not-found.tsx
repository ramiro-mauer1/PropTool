import Link from "next/link";

// Sin esto Next sirve su 404 por defecto, que viene con `background:#fff` y
// aparece como una pantalla totalmente en blanco dentro de una app oscura.
export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#09090B] px-4 py-8">
      <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <p className="text-2xs font-mono uppercase tracking-widest text-[#8f96a3]">
          Error 404
        </p>
        <h1 className="text-lg font-semibold text-[#FAFAFA]">
          Esta página no existe
        </h1>
        <p className="text-sm text-[#8f96a3]">
          El enlace puede estar vencido o haber cambiado de lugar.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex items-center justify-center px-4 py-2.5 min-h-[44px] rounded-md bg-accent text-zinc-950 text-sm font-semibold shadow-subtle hover:bg-accent-hover transition-colors active:scale-[0.98]"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
