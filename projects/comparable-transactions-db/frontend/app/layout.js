import "./globals.css";

export const metadata = {
  title: "Comparable Transactions Database",
  description:
    "Illustrative precedent LBO transaction database for benchmarking purchase multiples, financing structures and exits.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <a href="/" style={{ color: "inherit", textDecoration: "none" }}>
              <div className="site-title">Comparable Transactions Database</div>
              <div className="site-subtitle">
                Precedent LBO benchmarking — illustrative demo data
              </div>
            </a>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
