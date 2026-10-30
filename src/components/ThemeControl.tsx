"use client";
import { useEffect, useRef } from "react";
export function ThemeControl() {
  const select = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    function sync() {
      let theme = "system";
      try {
        theme = localStorage.getItem("punnett-studio-theme") ?? "system";
      } catch {}
      if (!["night", "lights-on", "system"].includes(theme)) theme = "system";
      document.documentElement.dataset.theme = theme;
      if (select.current) select.current.value = theme;
    }
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <label className="theme-control">
      Appearance
      <select
        ref={select}
        defaultValue="system"
        onChange={(e) => {
          const theme = e.target.value;
          document.documentElement.dataset.theme = theme;
          try {
            localStorage.setItem("punnett-studio-theme", theme);
          } catch {}
        }}
      >
        <option value="night">Dark</option>
        <option value="lights-on">Light</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
