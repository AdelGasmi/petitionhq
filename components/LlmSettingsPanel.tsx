"use client";

import { useState, useEffect, useRef } from "react";
import { loadSettings, saveSettings, DEFAULTS, type Settings } from "@/lib/settings";

export function LlmSettingsPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSave() {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleReset() {
    setSettings(DEFAULTS);
    saveSettings(DEFAULTS);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="LLM settings"
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          open ? "bg-stone-200 text-stone-900" : "text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-stone-200 bg-surface-card shadow-xl">
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="text-sm font-semibold text-stone-900">LLM Settings</p>
            <p className="text-xs text-stone-400 mt-0.5">Applies to all AI drafting in this session</p>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Drafting model
                <span className="ml-1 text-stone-400 font-normal">(letters &amp; brief)</span>
              </label>
              <input
                type="text"
                className="input text-sm font-mono"
                value={settings.draftingModel}
                onChange={(e) => setSettings((s) => ({ ...s, draftingModel: e.target.value }))}
                placeholder={DEFAULTS.draftingModel}
                spellCheck={false}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Fast model
                <span className="ml-1 text-stone-400 font-normal">(JSON extraction &amp; classify)</span>
              </label>
              <input
                type="text"
                className="input text-sm font-mono"
                value={settings.fastModel}
                onChange={(e) => setSettings((s) => ({ ...s, fastModel: e.target.value }))}
                placeholder={DEFAULTS.fastModel}
                spellCheck={false}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Temperature
                <span className="ml-1 text-stone-400 font-normal">({settings.temperature.toFixed(2)})</span>
              </label>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={settings.temperature}
                onChange={(e) => setSettings((s) => ({ ...s, temperature: parseFloat(e.target.value) }))}
                className="w-full accent-stone-800"
              />
              <div className="flex justify-between text-[10px] text-stone-400 mt-0.5">
                <span>0.1 — focused</span>
                <span>1.0 — creative</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-stone-100 px-4 py-3">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn btn-primary px-4 py-1.5 text-xs"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
