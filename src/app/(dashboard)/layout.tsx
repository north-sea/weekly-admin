'use client';

import ProLayoutWrapper from '@/components/layout/ProLayoutWrapper';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProLayoutWrapper>
      {children}
    </ProLayoutWrapper>
  );
}