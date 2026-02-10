'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { StatCard } from '@/components/stat-card';
import { Users, TrendingUp, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalTemplates: 0,
    totalCompanies: 0,
    loading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const [leadsResult, templatesResult, companiesResult] = await Promise.all([
          supabase.from('leads_list').select('*', { count: 'exact', head: true }),
          supabase.from('search_templates').select('*', { count: 'exact', head: true }),
          supabase.from('companies').select('*', { count: 'exact', head: true }),
        ]);

        setStats({
          totalLeads: leadsResult.count || 0,
          totalTemplates: templatesResult.count || 0,
          totalCompanies: companiesResult.count || 0,
          loading: false,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    }

    fetchStats();
  }, []);

  if (stats.loading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-8">
          <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-[#141C33] to-transparent">            
              <h1 className="text-3xl font-bold text-white">Dashboard</h1>
              <p className="mt-1 text-gray-400">Analytics overview</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-[#1a1f2e]" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="mt-1 text-gray-400">Analytics overview</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Total Leads"
              value={stats.totalLeads}
              icon={Users}
              iconColor="text-blue-500"
            />
            <StatCard
              title="Total Templates"
              value={stats.totalTemplates}
              icon={FileText}
              iconColor="text-blue-500"
            />
            <StatCard
              title="Total Companies"
              value={stats.totalCompanies}
              icon={TrendingUp}
              iconColor="text-blue-500"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
