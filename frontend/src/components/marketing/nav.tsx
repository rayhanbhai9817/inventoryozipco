'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';
import { BrandLogo, Icon } from '@/components/ui/icon';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#workflow' },
  { label: 'Inventory engine', href: '#engine' },
  { label: 'Security', href: '#security' },
];

/**
 * Marketing header.
 *
 * Transparent over the hero, then gains a background and a hairline once the page
 * scrolls — so the top of the page feels open but the nav stays readable over
 * content.
 */
export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { resolved, toggle } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu when the viewport grows past the breakpoint.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const close = () => query.matches && setMenuOpen(false);

    query.addEventListener('change', close);
    return () => query.removeEventListener('change', close);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-border-subtle bg-surface-page/85 backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="Fast Sold LLC home">
          <BrandLogo size={30} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-[0.8125rem] font-medium text-content-secondary transition-colors hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={resolved === 'dark' ? 'sun' : 'moon'}
            onClick={toggle}
            aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          />
          <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Sign in
          </ButtonLink>
          <ButtonLink href="/register" size="sm" trailingIcon="arrow-right">
            Get started
          </ButtonLink>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={menuOpen ? 'x' : 'menu'}
            className="lg:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          />
        </div>
      </div>

      {menuOpen ? (
        <div className="animate-fade-in border-t border-border-subtle bg-surface-page lg:hidden">
          <nav className="container-page flex flex-col py-3" aria-label="Main">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between rounded-lg px-2 py-3 text-sm font-medium text-content-secondary transition-colors hover:bg-ink-100 hover:text-content-primary dark:hover:bg-surface-raised"
              >
                {link.label}
                <Icon name="chevron-right" size={16} className="text-content-tertiary" />
              </a>
            ))}
            <ButtonLink href="/login" variant="secondary" fullWidth className="mt-3 sm:hidden">
              Sign in
            </ButtonLink>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
