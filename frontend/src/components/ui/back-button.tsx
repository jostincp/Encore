"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type BackButtonProps = {
  className?: string;
  label?: string;
};

/**
 * BackButton
 * Botón de retroceso accesible y responsive ubicado en la parte superior izquierda.
 * - Usa `div` como contenedor raíz con `role="button"` y `tabIndex` para accesibilidad.
 * - Maneja eventos de click, touch y teclado (Enter/Espacio).
 * - Estilos con Tailwind (media queries implícitas) y un pequeño bloque de CSS para efectos.
 */
export default function BackButton({ className = "", label = "Regresar" }: BackButtonProps) {
  const router = useRouter();
  const touchActivated = React.useRef(false);

  const activate = () => {
    router.back();
  };

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchActivated.current = true;
    activate();
  };

  const onClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    // Evitar doble navegación si el touch ya disparó acción
    if (touchActivated.current) {
      touchActivated.current = false;
      return;
    }
    activate();
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  return (
    <div
      className={`back-button fixed top-4 left-4 md:top-6 md:left-6 lg:top-8 lg:left-8 z-50 ${className}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onKeyDown={onKeyDown}
    >
      <div
        className="group flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-4 py-3 md:px-5 md:py-3 min-w-[48px] min-h-[48px] text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary shadow-sm transition-all duration-150"
      >
        <ArrowLeft
          className="h-5 w-5 md:h-6 md:w-6 text-foreground"
          aria-hidden="true"
        />
        <span
          className="font-medium"
          style={{ fontSize: "clamp(0.9rem, 1vw + 0.5rem, 1rem)" }}
        >
          {label}
        </span>
      </div>

      <style jsx>{`
        /* Efecto sutil de desplazamiento del ícono en hover */
        .back-button :global(.group:hover svg) {
          transform: translateX(-2px);
          transition: transform 150ms ease;
        }

        /* Garantizar buen contraste en modo oscuro/claro si la app no provee clases */
        @media (prefers-color-scheme: dark) {
          .back-button :global(.group) {
            border-color: rgba(255, 255, 255, 0.15);
          }
        }

        @media (prefers-color-scheme: light) {
          .back-button :global(.group) {
            border-color: rgba(0, 0, 0, 0.08);
          }
        }
      `}</style>
    </div>
  );
}