import './globals.css';
import ClientEnhancements from '../components/ClientEnhancements';

export const metadata = {
  title: 'NYX-1 — Buy back your nights',
  description: 'NYX-1 makes sleep radically more efficient, so you recover in less of it and wake fully restored. No stimulants. No crash. No debt to tomorrow.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <div className="wrap nav-in">
            <a className="logo" href="/"><span className="mark"></span> NYX</a>
            <div className="nav-links">
              <a href="/#how">How it works</a>
              <a href="/#device">The device</a>
              <a href="/about">About</a>
              <a href="/#reserve" className="nav-cta">Reserve NYX-1</a>
            </div>
          </div>
        </nav>
        {children}
        <footer>
          <div className="wrap foot-in">
            <a className="logo" href="/"><span className="mark"></span> NYX</a>
            <div className="foot-links">
              <a href="/#how">How it works</a>
              <a href="/about">About the founder</a>
              <a href="/#reserve">Reserve</a>
            </div>
            <p>© 2026 NYX Labs. Sleep, returned.</p>
          </div>
        </footer>
        <ClientEnhancements />
      </body>
    </html>
  );
}
