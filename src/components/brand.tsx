import Link from "next/link";

export function Brand({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link className="brand" href={href}>
      <span className="brand-seal" aria-hidden="true">
        <svg viewBox="0 0 48 48" role="img">
          <path d="M24 4c4.3 6.4 10.5 8.8 17 8.9-4.3 4.4-5.2 10.2-2.8 16.8-6.4-2-11.8-.6-14.2 5.1-2.4-5.7-7.8-7.1-14.2-5.1 2.4-6.6 1.5-12.4-2.8-16.8C13.5 12.8 19.7 10.4 24 4Z" />
          <path className="brand-seal-line" d="M16 17h16M14 24h20M18 31h12M24 14v20" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>GiaPhaVN</strong>
        {!compact && <small>Gìn giữ nguồn cội</small>}
      </span>
    </Link>
  );
}

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="eyebrow">
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
