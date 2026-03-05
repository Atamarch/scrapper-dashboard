'use client';

import { useState, useEffect } from 'react';
import { DayNightToggle } from './DayNightToggle';

export function TopHeader() {
  const [isDark, setIsDark] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setIsDark(saved === 'dark');
    }

    // Check sidebar state
    const checkSidebarState = () => {
      const sidebarCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
      setIsSidebarCollapsed(sidebarCollapsed);
    };

    checkSidebarState();

    // Listen for storage changes (when sidebar is toggled)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sidebar-collapsed') {
        setIsSidebarCollapsed(e.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event from sidebar
    const handleSidebarToggle = () => {
      checkSidebarState();
    };

    window.addEventListener('sidebar-toggled', handleSidebarToggle);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebar-toggled', handleSidebarToggle);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    // Theme belum diimplementasi, cuma toggle visual aja dulu
  };

  return (
    <div 
      className={`flex-shrink-0 border-b border-gray-700 bg-[#1a1f2e] px-8 shadow-lg transition-all duration-300 ${
        isSidebarCollapsed ? 'py-4' : 'py-7'
      }`}
      style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}
    >
      <div className="flex items-center justify-end">
        <DayNightToggle isDark={isDark} onToggle={toggleTheme} />
      </div>
    </div>
  );
}
