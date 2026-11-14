"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (container: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
  }
}

export function TurnstileWidget({ onToken, action }: { onToken: (token: string) => void; action: string }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !container.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(container.current, { sitekey: siteKey, action, callback: onToken, "expired-callback": () => onToken("") });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-giaphavn-turnstile="true"]');
    if (existing) {
      if (window.turnstile) render(); else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true; script.defer = true; script.dataset.giaphavnTurnstile = "true"; script.addEventListener("load", render, { once: true });
      document.head.appendChild(script);
    }
    return () => { cancelled = true; if (widget.current && window.turnstile) window.turnstile.remove(widget.current); widget.current = undefined; };
  }, [action, onToken, siteKey]);
  if (!siteKey) return null;
  return <div className="turnstile-slot" ref={container} />;
}
