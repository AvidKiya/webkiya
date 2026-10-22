"use client";
import { useEffect, type ReactNode } from "react";
import { usePreviewTheme } from "@/lib/preview-store";
import { TemplateHeader, TemplateNavigation, TemplateBottomNav } from "./shell";
export function CustomerFrame({ children }: { children: ReactNode }) {
  const { theme, setTheme } = usePreviewTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return (
    <div className="app kiya-template template-customer-frame">
      <TemplateHeader
        theme={theme}
        toggleTheme={toggle}
        query=""
        setQuery={() => {}}
        section="basket"
        cartCount={0}
        inert={false}
      />
      <TemplateNavigation
        theme={theme}
        toggleTheme={toggle}
        section="basket"
        inert={false}
      />
      <div className="template-customer-content">{children}</div>
      <TemplateBottomNav section="basket" inert={false} />
    </div>
  );
}
