'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Calendar, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Crawler Scheduler', href: '/admin/dashboard/scheduler', icon: Calendar },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin-sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('admin-sidebar-collapsed', String(newState));
  };

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin');
  }

  return (
    <div 
      className={cn(
        'flex h-screen flex-col border-r border-gray-800 bg-zinc-950 text-gray-300',
        isCollapsed ? 'w-20' : 'w-64'
      )} 
      style={{ transition: 'width 0.3s ease' }}
      suppressHydrationWarning
    >
      <div className="flex items-center justify-between border-b border-gray-800 p-6">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-blue-500/10 shadow-lg shadow-blue-600/40">
              <img 
                src="/logo_sarana_ai.jpg" 
                alt="Sarana AI Logo" 
                className="h-10 w-10 object-cover"
              />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Admin Panel</h1>
              <p className="text-sm text-gray-400">Crawler Management</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-blue-500/10 shadow-lg shadow-blue-600/40 mx-auto">
            <img 
              src="/logo_sarana_ai.jpg" 
              alt="Sarana AI Logo" 
              className="h-10 w-10 object-cover"
            />
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
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:bg-zinc-900 hover:text-white',
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

      <div className="border-t border-gray-800 p-4 space-y-2">
        <button
          onClick={handleLogout}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-zinc-900 hover:text-white',
            isCollapsed && 'justify-center'
          )}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && 'Logout'}
        </button>
        
        <button
          onClick={toggleCollapse}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 transition-colors hover:bg-zinc-900 hover:text-white',
            isCollapsed && 'justify-center'
          )}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              Minimize
            </>
          )}
        </button>
      </div>
    </div>
  );
}
