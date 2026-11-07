/** Monogram: an open book whose spine doubles as a check mark. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--ink)" />
      <path
        d="M7.5 10.2c2.9-.9 5.6-.6 8.5 1.1v11.4c-2.9-1.6-5.6-1.9-8.5-1V10.2Z"
        stroke="var(--paper)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M24.5 10.2c-2.9-.9-5.6-.6-8.5 1.1v11.4c2.9-1.6 5.6-1.9 8.5-1V10.2Z"
        stroke="var(--paper)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity=".55"
      />
      <circle cx="24" cy="8" r="2.4" fill="var(--accent)" />
    </svg>
  );
}
