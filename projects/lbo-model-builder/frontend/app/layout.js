import "./globals.css";

export const metadata = {
  title: "LBO Model Builder",
  description: "A simple leveraged buyout modeling tool -- illustrative only, not investment advice.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
