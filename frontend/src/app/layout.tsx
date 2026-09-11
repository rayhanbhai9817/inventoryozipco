import type { Metadata, Viewport } from 'next';

import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, ThemeScript } from '@/lib/theme';
import { ToastProvider } from '@/components/ui/toast';

import './globals.css';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Fast Sold LLC';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Inventory Management`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Multi-tenant inventory management for growing businesses. Track stock in and stock out with true FIFO batch costing, supplier records, an immutable ledger and reports your team will actually read.',
  applicationName: APP_NAME,
  authors: [{ name: APP_NAME }],
  keywords: [
    'inventory management',
    'stock control',
    'FIFO inventory',
    'warehouse software',
    'supplier management',
    'inventory ledger',
  ],
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: `${APP_NAME} — Inventory Management`,
    description:
      'Know exactly what you hold, where it came from and what moved — with FIFO batch tracking and an inventory ledger you can trust.',
  },
  // The dashboard is private; there is nothing here for a crawler to index
  // beyond the landing page, and indexing authenticated routes is undesirable.
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f9fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1014' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint, so a dark-mode user never
            sees a white flash. */}
        <ThemeScript />
        {/* Inter, with a full system fallback stack in globals.css. If the font
            never arrives the interface is still correct, just in the platform
            face — preferable to a blocking render. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font --
            The rule warns about fonts loaded outside `pages/_document.js`, which
            does not exist in the App Router: this *is* the document head, shared
            by every route, so the font is loaded once and not per page. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&family=Inter+Tight:wght@500..700&display=swap"
        />
      </head>
      <body>
        {/* Keyboard users land here first and can jump straight past the nav. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
