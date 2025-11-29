'use client';

import React from 'react';
import AppSidebar from './AppSidebar';
import SiteHeader from './SiteHeader';
import { SidebarProvider } from './sidebar-context';

interface ProLayoutWrapperProps {
  children: React.ReactNode;
}

const ProLayoutWrapper: React.FC<ProLayoutWrapperProps> = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        <AppSidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <SiteHeader />
          <main className="flex-1 p-6">
            <div className="mx-auto w-full max-w-7xl space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ProLayoutWrapper;
