import type { Metadata } from 'next';
import ClientProvider from '@/components/providers/ClientProvider';
import ErrorBoundary from '@/components/providers/ErrorBoundary';
import NoSSR from '@/components/providers/NoSSR';
import QueryProvider from '@/components/providers/QueryProvider';
import StartupProvider from '@/components/providers/StartupProvider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

export const metadata: Metadata = {
  title: 'Weekly 内容管理系统',
  description: '专业的周刊内容管理平台'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <ErrorBoundary>
          <QueryProvider>
            <NoSSR>
              <StartupProvider>
                <ClientProvider>
                  {children}
                  <Toaster />
                </ClientProvider>
              </StartupProvider>
            </NoSSR>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
