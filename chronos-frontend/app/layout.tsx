import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { UserProvider } from '@/contexts/UserContext';
import { ToastProvider } from '@/contexts/ToastContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Chronos - Luxury Timepieces',
  description: 'Premium luxury watch collection with personalized recommendations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UserProvider>
          <ToastProvider>
            <Navbar />
            <main className="min-h-screen bg-gray-50">
              {children}
            </main>
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}
