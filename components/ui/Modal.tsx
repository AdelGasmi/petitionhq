"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Modal — the single dialog shell (DESIGN.md §3.10).
 *
 * Replaces the ad-hoc `fixed inset-0 z-50 …` overlays that re-implemented a
 * dialog without accessibility. Provides, with no portal/library:
 *  - role="dialog" aria-modal aria-labelledby (title)
 *  - focus moves in on open, is trapped while open, returns to trigger on close
 *  - Escape + backdrop click close (unless dismissable={false})
 *  - body scroll lock while open
 */

type Size = "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  md: "max-w-md", // 28rem
  lg: "max-w-lg", // 32rem
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  dismissable = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: Size;
  /** When false, Escape and backdrop click do not close (destructive flows). */
  dismissable?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // The element focused before the modal opened — focus returns here on close.
  const triggerRef = useRef<HTMLElement | null>(null);
  // Latest callbacks held in refs so the open/close effect depends ONLY on `open`.
  // Inline `onClose={() => …}` props change identity every render; if they were in
  // the dep array, the effect would re-run on every parent re-render (e.g. each
  // keystroke in a field) and steal focus back to the first focusable element.
  const onCloseRef = useRef(onClose);
  const dismissableRef = useRef(dismissable);
  onCloseRef.current = onClose;
  dismissableRef.current = dismissable;

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    // Lock body scroll.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog (first focusable, else the panel itself).
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissableRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      // Focus trap: cycle within the panel's focusable elements.
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstEl || active === panel)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      // Return focus to the trigger.
      triggerRef.current?.focus?.();
    };
    // Only re-run on open/close — callbacks are read from refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-overlay p-4"
      onMouseDown={(e) => {
        // Only a click that starts AND ends on the backdrop dismisses.
        if (e.target === e.currentTarget && dismissable) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`card w-full ${SIZE_CLASS[size]} max-h-[calc(100vh-2rem)] space-y-4 overflow-y-auto rounded-2xl shadow-lg outline-none`}
      >
        <h3 id={titleId} className="font-serif text-xl">
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

/** Right-aligned action row for modal footers (ghost/secondary cancel + primary confirm). */
export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2">{children}</div>;
}
