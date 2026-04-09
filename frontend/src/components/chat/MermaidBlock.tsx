"use client";

import mermaid from "mermaid";
import { useEffect, useId, useRef, useState } from "react";

interface MermaidBlockProps {
  code: string;
}

let initialized = false;

export function MermaidBlock({ code }: MermaidBlockProps) {
  const [showSource, setShowSource] = useState(false);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartId = useId().replace(/:/g, "-");

  useEffect(() => {
    if (showSource || failed || !containerRef.current) {
      return;
    }

    if (!initialized) {
      mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict" });
      initialized = true;
    }

    let cancelled = false;

    mermaid
      .render(`mermaid-${chartId}`, code)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chartId, code, failed, showSource]);

  const showCode = showSource || failed;

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-stone-200 bg-white/80">
      <div className="flex items-center justify-end border-b border-stone-200 px-3 py-2 text-xs text-stone-500">
        <button
          type="button"
          onClick={() => setShowSource((prev) => !prev)}
          className="rounded-md px-2 py-1 transition hover:bg-stone-100 hover:text-stone-700"
        >
          {showCode ? "查看图" : "查看源码"}
        </button>
      </div>

      {showCode ? (
        <pre className="overflow-x-auto px-4 py-3 text-sm text-stone-700">{code}</pre>
      ) : (
        <div ref={containerRef} data-testid="mermaid-diagram" className="px-4 py-3 text-sm text-stone-500" />
      )}
    </div>
  );
}
