'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, Building2, FileText, Calendar, ChevronLeft, ChevronRight, LogOut, ChevronDown, Settings, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Company', href: '/company', icon: Building2 },
  { name: 'Requirements', href: '/requirements', icon: FileText },
  { name: 'Scheduler', href: '/scheduler', icon: Calendar },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const lastToastTime = useRef<number>(0);

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'User');
      }
    }
    getUserData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
    if (newState) {
      setShowProfileDropdown(false);
    }
  };

  const handleProfileClick = () => {
    const now = Date.now();
    // Only show toast if 2 seconds have passed since last toast
    if (now - lastToastTime.current > 2000) {
      toast('Expand sidebar to view profile', {
        icon: <Info className='text-blue-400'/>,
      });
      lastToastTime.current = now;
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  return (
    <div 
      className={cn(
        'flex h-screen flex-col bg-[#1a1f2e] text-gray-300',
        isCollapsed ? 'w-20' : 'w-64'
      )} 
      style={{ transition: 'width 0.3s ease' }}
      suppressHydrationWarning
    >
      <div className="flex items-center justify-between border-b border-gray-700 p-6">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden">
              <Image src="/logo-sarana-without-text.png" alt="Sarana AI Logo" width={30} height={30}/>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Sarana AI</h1>
              <p className="text-sm text-gray-400">Lead Management</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex h-12 w-10 items-center justify-center overflow-hidden mx-auto">
            <Image src="/logo-sarana-without-text.png" alt="Sarana AI Logo" width={30} height={30} />
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
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

        {/* Profile Section - Inline in nav */}
        {!isCollapsed && (
          <div className="pt-4 mt-4 border-t border-gray-700/50">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex w-full items-center gap-3 rounded-lg p-3 hover:bg-gray-700/30 transition-all group"
            >
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                {userName.charAt(0).toUpperCase()}
                <div className="absolute inset-0 rounded-full bg-blue-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">{userName}</p>
                <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              </div>
              <ChevronDown className={cn(
                'h-4 w-4 text-gray-500 transition-all flex-shrink-0 group-hover:text-gray-400',
                showProfileDropdown && 'rotate-180 text-blue-400'
              )} />
            </button>

            {/* Dropdown expands below with animation */}
            {showProfileDropdown && (
              <div className="mt-2 space-y-1 animate-slideDown relative">
                {/* Fancy background with concave shape */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800/40 via-gray-700/30 to-gray-800/40 backdrop-blur-sm" 
                     style={{
                       borderRadius: '12px',
                       boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.2)'
                     }}
                />
                
                <div className="relative p-2 space-y-1">
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      router.push('/profile');
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-700/30 transition-all rounded-lg group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 group-hover:bg-blue-500/20 transition-colors">
                      <Settings className="h-4 w-4 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <span>Profile Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all rounded-lg group"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700/50 group-hover:bg-red-500/20 transition-colors">
                      <LogOut className="h-4 w-4 group-hover:text-red-400 transition-colors" />
                    </div>
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapsed state - show avatar */}
        {isCollapsed && (
          <div className="pt-4 mt-4 border-t border-gray-700/50">
            <button
              onClick={handleProfileClick}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-sm mx-auto hover:scale-110 transition-transform group"
              title={userName}
            >
              {userName.charAt(0).toUpperCase()}
              <div className="absolute inset-0 rounded-full bg-blue-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
            </button>
          </div>
        )}
      </nav>

      {/* Help & Feedback removed, only Minimize button */}
      <div className="border-t border-gray-700 p-4">
        <button
          onClick={toggleCollapse}
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
              Minimize
            </>
          )}
        </button>
      </div>
    </div>
  );
}
