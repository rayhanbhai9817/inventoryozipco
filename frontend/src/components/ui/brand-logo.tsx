'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * The Ozipco Inventory logo.
 *
 * Renders the real brand asset from `public/brand/ozipco-logo.png`. If that
 * file is missing the component falls back to a drawn wordmark instead of a
 * broken-image icon, so a deploy that forgets the asset degrades quietly rather
 * than putting a torn graphic at the top of the sign-in page.
 *
 * To install the real logo: save it as
 *
 *     frontend/public/brand/ozipco-logo.png      (or .svg — update LOGO_SRC)
 *
 * Nothing else needs changing. Transparent background, and at least 2x the
 * largest rendered height (the sign-in page renders it at 36px, so ≥72px tall).
 */
const LOGO_SRC = '/brand/ozipco-logo.png';

/** Ozipco red, sampled from the brand mark. Used only by the fallback. */
const OZIPCO_RED = '#C8102E';

export interface BrandLogoProps {
  /** Rendered height in pixels. Width follows the logo's aspect ratio. */
  size?: number;
  /** Ignored by the image logo; kept so the collapsed sidebar can hide the wordmark. */
  showWordmark?: boolean;
  className?: string;
}

export function BrandLogo({ size = 32, showWordmark = true, className }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // The <img> is server-rendered, so a missing file fails to load before React
  // hydrates and the onError handler below never fires. Re-check on mount: a
  // finished image with no intrinsic width did not load.
  useEffect(() => {
    const image = imageRef.current;

    if (image?.complete && image.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  // Collapsed sidebar: show just the mark, not the full wordmark.
  if (!showWordmark) {
    return <BrandMark size={size} className={className} />;
  }

  if (failed) {
    return <OzipcoWordmark height={size} className={className} />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element --
       A static, locally-served brand asset of known size. next/image would add
       a loader and layout machinery for no benefit, and its error handling
       would not let this component fall back cleanly. */
    <img
      ref={imageRef}
      src={LOGO_SRC}
      alt="Ozipco Inventory"
      style={{ height: size }}
      className={cn('w-auto shrink-0 object-contain', className)}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Square mark for tight spaces — the collapsed sidebar rail and the favicon
 * slot. The brand is a wordmark in a rounded frame, so the mark keeps the frame
 * and shows the leading letter.
 */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect
        x="1.75"
        y="1.75"
        width="36.5"
        height="36.5"
        rx="12"
        stroke={OZIPCO_RED}
        strokeWidth="3.5"
      />
      <circle cx="20" cy="20" r="7.25" stroke={OZIPCO_RED} strokeWidth="3.5" />
    </svg>
  );
}

/**
 * Text fallback for when the logo file is absent. Deliberately a plain
 * approximation — it is a placeholder, not a substitute for the real asset.
 */
function OzipcoWordmark({ height, className }: { height: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center', className)}
      style={{ height }}
      title="Add frontend/public/brand/ozipco-logo.png to show the real logo"
    >
      <span
        className="inline-flex items-center rounded-full border-[0.1em] px-[0.42em] font-semibold lowercase"
        style={{
          borderColor: OZIPCO_RED,
          color: OZIPCO_RED,
          fontSize: height * 0.62,
          letterSpacing: '-0.01em',
          lineHeight: 1.55,
        }}
      >
        ozipco
      </span>
    </span>
  );
}
