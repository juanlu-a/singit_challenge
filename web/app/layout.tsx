import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Singit — Practice',
  description: 'Learn English through music: practice vocabulary built from song word insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand" style={{ color: '#fff' }}>
              <span className="logo">🎵</span>
              <span>
                <h1>Singit</h1>
                <p>Learn English through music</p>
              </span>
            </Link>
            <nav className="header-nav">
              <Link href="/">Dashboard</Link>
              <Link href="/practice">Practice</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
