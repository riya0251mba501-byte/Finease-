export function FinEaseLogo({
  size = 'md',
  showWordmark = true,
}: {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}) {
  const iconDim = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-9 w-9' : 'h-7 w-7';
  const textClass =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconDim} shrink-0`}
        aria-hidden="true"
      >
        <rect
          width="32"
          height="32"
          rx="8"
          className="fill-[var(--brand-primary)]"
        />
        <path
          d="M9.5 11.25H22.5M9.5 11.25V22.25M9.5 16.5H19.25"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19.5 21.75C21.85 21.75 23.75 19.85 23.75 17.5C21.4 17.5 19.5 19.4 19.5 21.75Z"
          fill="#A7F3D0"
        />
      </svg>
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-tight text-[var(--text-primary)] ${textClass}`}
        >
          FinEase
        </span>
      )}
    </span>
  );
}
