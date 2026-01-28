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
      <div className="flex min-h-screen bg-background text-foreground">
        <div className="hidden md:flex">
          <AppSidebar />
        </div>
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <SiteHeader />
          <main className="flex-1 min-w-0 p-4 sm:p-6">
            <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ProLayoutWrapper;
