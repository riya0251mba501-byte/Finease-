import { useState } from 'react';
import { Package } from 'lucide-react';

interface ProductImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectClass?: string;
}

export function ProductImage({
  src,
  alt,
  className = '',
  aspectClass = 'aspect-[4/3]',
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${aspectClass} flex flex-col items-center justify-center gap-2 bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] px-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="h-7 w-7 opacity-60" />
        <span className="text-xs font-medium line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`${aspectClass} overflow-hidden bg-[var(--bg-surface-subtle)] ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
