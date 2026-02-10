'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Company', href: '/company', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={cn(
      'flex h-screen flex-col bg-[#1a1f2e] text-gray-300 transition-all duration-300',
      isCollapsed ? 'w-20' : 'w-64'
    )}>
      <div className="flex items-center justify-between border-b border-gray-700 p-6">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-blue-500/10 shadow-lg shadow-blue-600/40">
              <Image src="/logo_sarana_ai.jpg" alt="Sarana AI Logo" width={40} height={40} className="object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Sarana AI</h1>
              <p className="text-sm text-gray-400">Lead Management</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-blue-500/10 shadow-lg shadow-blue-600/40 mx-auto">
            <Image src="/logo_sarana_ai.jpg" alt="Sarana AI Logo" width={40} height={40} className="object-cover" />
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-700/50 text-white'
                  : 'text-gray-400 hover:bg-gray-700/30 hover:text-white',
                isCollapsed && 'justify-center'
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-700 p-4">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-700/30 hover:text-white',
            isCollapsed && 'justify-center'
          )}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              Collapse
            </>
          )}
        </button>
      </div>
    </div>
  );
}
