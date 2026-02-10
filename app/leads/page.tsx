'use client';

import { Suspense } from 'react';
import LeadsContent from './leads-content';
import { Sidebar } from '@/components/sidebar';

export const dynamic = 'force-dynamic';

export default function LeadsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white">Leads</h1>
              <p className="mt-1 text-gray-400">Loading...</p>
            </div>
          </div>
        </main>
      </div>
    }>
      <LeadsContent />
    </Suspense>
  );
}
