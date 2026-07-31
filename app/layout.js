import './globals.css';

export const metadata = {
  title: 'NYX',
  description: 'NYX Labs.',
};

/**
 * Deliberately bare. Two products live in this app — the NYX-1 marketing site
 * and the FGCU Student Investment Group platform — and each brings its own chrome via a
 * route-group layout.
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
