"use client";

import { forwardRef, useEffect, useRef, useImperativeHandle } from "react";

/**
 * Matches the LLM's citation-needed placeholder in any of the shapes it tends
 * to write it — "[CITE needed]", "[CITE needed — specific date]", "[CITE: id]".
 */
const CITE_PATTERN = /\[CITE[^\]]*\]/gi;

function renderHighlighted(text: string) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const re = new RegExp(CITE_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    nodes.push(
      <mark key={key++} className="bg-transparent text-danger-fill font-semibold">
        {match[0]}
      </mark>
    );
    lastIndex = match.index + match[0].length;
  }
  nodes.push(text.slice(lastIndex));
  // Trailing newline so the caret at the very end of the text lines up with
  // the overlay the same way it would in a plain textarea.
  nodes.push("\n");
  return nodes;
}

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Drop-in replacement for <textarea> that renders `[CITE ...]` placeholders
 * in red. Textareas can't style substrings natively, so this overlays a
 * matching, non-interactive <div> behind a textarea whose own text is made
 * transparent — the classic "highlighted textarea" technique. The real
 * textarea stays the interactive layer (selection, caret, editing all work
 * normally); the div only supplies color.
 */
export const HighlightedTextarea = forwardRef<HTMLTextAreaElement, Props>(function HighlightedTextarea(
  { value, className = "", onScroll, style, ...rest },
  ref
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const syncScroll = () => {
    if (innerRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = innerRef.current.scrollTop;
      overlayRef.current.scrollLeft = innerRef.current.scrollLeft;
    }
  };

  useEffect(syncScroll, [value]);

  const text = typeof value === "string" ? value : "";

  return (
    <div className="relative">
      <div
        ref={overlayRef}
        aria-hidden="true"
        className={`${className} pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words`}
        style={{ ...style, color: "var(--text-primary)" }}
      >
        {renderHighlighted(text)}
      </div>
      <textarea
        {...rest}
        ref={innerRef}
        value={value}
        className={`${className} relative bg-transparent`}
        style={{ ...style, color: "transparent", caretColor: "var(--text-primary)" }}
        onScroll={(e) => {
          syncScroll();
          onScroll?.(e);
        }}
      />
    </div>
  );
});
