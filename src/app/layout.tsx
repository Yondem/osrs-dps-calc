import React, { PropsWithChildren } from 'react';
import 'react-toastify/dist/ReactToastify.css';
import '@xyflow/react/dist/style.css';
import '../globals.css';
import { Metadata } from 'next';
import { ibm, pts } from '@/fonts';
import ClientProviders from '@/app/components/ClientProviders';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || ''),
  title: 'DPS Calculator - Vind edition',
  description: "See how your gear stacks up against Old School RuneScape's monsters, and find the best setup from your bank. Based on the OSRS Wiki's DPS calculator.",
  keywords: ['osrs', 'old school runescape', 'runescape', 'dps calculator', 'osrs dps', 'best in slot', 'gear optimizer'],
  alternates: { canonical: `${process.env.NEXT_PUBLIC_BASE_URL}${process.env.NEXT_PUBLIC_BASE_PATH}` },
  twitter: {
    card: 'summary',
  },
};

/**
 * Allowlist of what self-hosted builds may load, so the page can't contact anything else even if a dependency tried to.
 * Other sites: player lookups (oldschool.runescape.wiki), opening old wiki share links
 * (tools.runescape.wiki) and the RuneLite WikiSync plugin on your own computer (ws://localhost).
 * Next.js inlines its startup scripts, so those need 'unsafe-inline'.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://oldschool.runescape.wiki https://tools.runescape.wiki ws://localhost:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const RootLayout: React.FC<PropsWithChildren> = (props) => {
  const { children } = props;

  return (
  // We are suppressing hydration warnings here so that react-themes works correctly.
  // See https://github.com/pacocoursey/next-themes/issues/152#issuecomment-1364280564
    <html suppressHydrationWarning lang="en" className={`${pts.variable} ${ibm.variable}`}>
      {process.env.NEXT_PUBLIC_SELF_HOSTED && (
        <head>
          <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
          <meta name="referrer" content="strict-origin-when-cross-origin" />
        </head>
      )}
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
};

export default RootLayout;
