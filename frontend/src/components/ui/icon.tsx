import type { SVGProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * The Fast Sold icon set.
 *
 * Hand-drawn rather than pulled from a package: it keeps the bundle small, gives
 * every glyph the same 24×24 grid, 1.75 stroke weight and round caps, and avoids
 * shipping several hundred icons to use thirty. Icons inherit `currentColor`, so
 * they take their colour from whatever they sit inside.
 */

export type IconName =
  | 'activity'
  | 'alert-circle'
  | 'alert-triangle'
  | 'archive'
  | 'arrow-down'
  | 'arrow-down-right'
  | 'arrow-left'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow-up-right'
  | 'bell'
  | 'boxes'
  | 'building'
  | 'calendar'
  | 'check'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'clock'
  | 'copy'
  | 'download'
  | 'edit'
  | 'external-link'
  | 'eye'
  | 'eye-off'
  | 'file-text'
  | 'filter'
  | 'gauge'
  | 'history'
  | 'image'
  | 'info'
  | 'layers'
  | 'lock'
  | 'log-out'
  | 'mail'
  | 'menu'
  | 'minus'
  | 'moon'
  | 'more-horizontal'
  | 'package'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'shield'
  | 'sliders'
  | 'sparkles'
  | 'sun'
  | 'tag'
  | 'trash'
  | 'trending-down'
  | 'trending-up'
  | 'truck'
  | 'upload'
  | 'user'
  | 'user-plus'
  | 'users'
  | 'x'
  | 'zap';

/** Path data for each glyph, drawn on a 24×24 grid. */
const PATHS: Record<IconName, string> = {
  activity: 'M3 12h3.5L9 5l3 14 3-9 2 2h4',
  'alert-circle': 'M12 8v4.5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  'alert-triangle':
    'M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01',
  archive: 'M3 7h18M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M5 7 6.5 4h11L19 7M9.5 12h5',
  'arrow-down': 'M12 4v16M6 14l6 6 6-6',
  'arrow-down-right': 'M7 7l10 10M17 9v8h-8',
  'arrow-left': 'M20 12H4M10 6l-6 6 6 6',
  'arrow-right': 'M4 12h16M14 6l6 6-6 6',
  'arrow-up': 'M12 20V4M6 10l6-6 6 6',
  'arrow-up-right': 'M7 17 17 7M9 7h8v8',
  bell: 'M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9ZM10.3 19a2 2 0 0 0 3.4 0',
  boxes:
    'M3 8.5 7.5 6 12 8.5v5L7.5 16 3 13.5v-5ZM12 8.5 16.5 6 21 8.5v5L16.5 16 12 13.5M7.5 11v5M16.5 11v5M12 13.5 7.5 16v4.5',
  building:
    'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h3a2 2 0 0 1 2 2v10M3 21h18M8 7h4M8 11h4M8 15h4',
  calendar: 'M4 6h16v14H4V6ZM8 3v4M16 3v4M4 11h16',
  check: 'M4.5 12.5 9.5 18 20 6',
  'check-circle': 'M8.5 12.5 11 15l4.5-5.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  'chevron-down': 'm6 9.5 6 6 6-6',
  'chevron-left': 'm14.5 6-6 6 6 6',
  'chevron-right': 'm9.5 6 6 6-6 6',
  'chevron-up': 'm6 14.5 6-6 6 6',
  clock: 'M12 7.5V12l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  copy: 'M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  edit: 'M12 20H5a1 1 0 0 1-1-1v-7M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4 10.5-10.5Z',
  'external-link': 'M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9.25A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 0 0 12 9.25Z',
  'eye-off': 'M4 4l16 16M10 5.8A7.7 7.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.5M6.2 8.2A17 17 0 0 0 2.5 12S6 18.5 12 18.5c.9 0 1.7-.1 2.5-.4M10.1 10.1a2.75 2.75 0 0 0 3.8 3.8',
  'file-text': 'M13 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9l-6-6ZM13 3v6h6M9 13h6M9 17h4',
  filter: 'M3 5h18l-7 8v6l-4-2v-4L3 5Z',
  gauge: 'M12 13l4-4M4 19a9 9 0 1 1 16 0M12 13a1 1 0 1 0 0 .01',
  history: 'M12 8v4.5l3.5 2M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3 4v4h4',
  image: 'M4 4h16v16H4V4ZM8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 17l4.5-4.5 3.5 3.5 3-3L20 17',
  info: 'M12 11v5M12 7.5h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 12.5l9 5 9-5M3 17l9 5 9-5',
  lock: 'M6 11h12v10H6V11ZM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11M12 15v2',
  'log-out': 'M14 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8M17 8l4 4-4 4M21 12H10',
  mail: 'M3 6h18v12H3V6ZM3 7l9 6.5L21 7',
  menu: 'M4 7h16M4 12h16M4 17h16',
  minus: 'M5 12h14',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
  'more-horizontal': 'M6 12h.01M12 12h.01M18 12h.01',
  package: 'M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5v-9ZM3.5 7.5 12 12l8.5-4.5M12 12v9M7.75 5.25l8.5 4.5',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 0 0-13.7-4.8L3 9M3 4v5h5M4 13a8 8 0 0 0 13.7 4.8L21 15M21 20v-5h-5',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-2.9-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.1-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4.9Z',
  shield: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3ZM9.5 12l2 2 3.5-4',
  sliders: 'M4 8h10M18 8h2M4 16h4M12 16h8M16 5v6M8 13v6',
  sparkles:
    'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3ZM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2ZM5 15l.6 1.6 1.6.6-1.6.6L5 19.4l-.6-1.6L2.8 17l1.6-.6L5 15Z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  tag: 'M20.6 12.6 12 21.2a2 2 0 0 1-2.8 0l-6.4-6.4a2 2 0 0 1 0-2.8L11.4 3.4a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.4a2 2 0 0 1-.4 1.4ZM16.5 8h.01',
  trash: 'M4 7h16M9 7V4.5h6V7M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7M10 11v6M14 11v6',
  'trending-down': 'M22 17l-8.5-8.5-4 4L2 5M16 17h6v-6',
  'trending-up': 'M22 7l-8.5 8.5-4-4L2 19M16 7h6v6',
  truck:
    'M2 7h11v9H2V7ZM13 10h4l3 3.5V16h-7M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  user: 'M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0',
  'user-plus': 'M10 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a7 7 0 0 1 14 0M19 8v6M16 11h6',
  users:
    'M9 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16.5 3.8a4 4 0 0 1 0 7.4M18 14.2a7 7 0 0 1 4 6.8',
  x: 'M6 6l12 12M18 6 6 18',
  zap: 'M13.5 2 4 14h6l-.5 8L19 10h-6l.5-8Z',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Pixel size; the icon is always square. */
  size?: number;
  /** Accessible label. Without one the icon is hidden from assistive tech. */
  label?: string;
}

export function Icon({ name, size = 20, label, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      {...props}
    >
      {label ? <title>{label}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * The Fast Sold brandmark: two stacked chevrons forming a forward-moving "S",
 * inside a rounded square. Filled rather than stroked, so it holds up at 20px in
 * a sidebar and at 64px on the landing page.
 */
export function BrandMark({ size = 32, className, ...props }: Omit<IconProps, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
      {...props}
    >
      <rect width="40" height="40" rx="11" fill="url(#fs-brand-gradient)" />
      <path
        d="M11.5 13.5h14l-5.2 5.2h-8.8l-2.4-2.6 2.4-2.6Z"
        fill="white"
        fillOpacity="0.95"
      />
      <path
        d="M28.5 26.5h-14l5.2-5.2h8.8l2.4 2.6-2.4 2.6Z"
        fill="white"
        fillOpacity="0.72"
      />
      <defs>
        <linearGradient id="fs-brand-gradient" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#1F9FA5" />
          <stop offset="0.55" stopColor="#137E87" />
          <stop offset="1" stopColor="#FF5A1F" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Wordmark + brandmark, used in the header, sidebar and auth screens. */
export function BrandLogo({
  size = 32,
  showWordmark = true,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark size={size} />
      {showWordmark ? (
        <span className="font-display text-[1.0625rem] leading-none font-semibold tracking-tight text-content-primary">
          Fast Sold
          <span className="ml-1 align-text-top text-[0.5625rem] font-medium tracking-[0.14em] text-content-tertiary uppercase">
            LLC
          </span>
        </span>
      ) : null}
    </span>
  );
}
