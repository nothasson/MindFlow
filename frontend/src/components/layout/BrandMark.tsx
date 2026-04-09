export function BrandMark({ className = "h-8 w-8 text-[#C67A4A]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      data-testid="brand-mark"
    >
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <path d="M12 2.5V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 17V21.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2.5 12H7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 12H21.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.28 5.28L8.46 8.46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.54 15.54L18.72 18.72" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18.72 5.28L15.54 8.46" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.46 15.54L5.28 18.72" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 4.8V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M12 15V19.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M4.8 12H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <path d="M15 12H19.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
