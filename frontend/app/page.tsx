'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';
import { StatCard } from '@/components/stat-card';
import { Users, FileText, Building2, TrendingUp, Clock, CheckCircle2, BarChart3, Percent } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface LeadsByDate {
  date: string;
  count: number;
}

interface StatusCount {
  connection_status: string;
  count: number;
}

interface ScoreRange {
  range: string;
  count: number;
  percentage: number;
  color: string;
}

interface RecentLead {
  id: string;
  name: string;
  connection_status: string;
  processed_at: string;
  profile_data: any;
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalTemplates: 0,
    totalCompanies: 0,
    loading: true,
  });

  const [leadsByDate, setLeadsByDate] = useState<LeadsByDate[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [scoreRanges, setScoreRanges] = useState<ScoreRange[]>([]);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

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

  useEffect(() => {
    async function fetchChartData() {
      try {
        // Fetch all leads data
        const { data: leadsData } = await supabase
          .from('leads_list')
          .select('date, connection_status, profile_data, score')
          .order('date', { ascending: false });

        if (!leadsData || leadsData.length === 0) {
          setChartsLoading(false);
          return;
        }

        // Leads by date (last 4 months) - Generate all 4 months
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        const dateMap = new Map<string, number>();
        
        // Generate last 4 months (including current month)
        for (let i = 3; i >= 0; i--) {
          const date = new Date(today);
          date.setMonth(today.getMonth() - i);
          date.setDate(1); // First day of the month
          date.setHours(0, 0, 0, 0);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          dateMap.set(dateStr, 0); // Initialize with 0
        }
        
        // Count actual leads for each month (using 'date' field for when lead was crawled)
        const fourMonthsAgo = new Date(today);
        fourMonthsAgo.setMonth(today.getMonth() - 3); // 4 months including current month
        fourMonthsAgo.setDate(1); // First day of the month
        fourMonthsAgo.setHours(0, 0, 0, 0);
        
        console.log('=== LEADS TREND DEBUG ===');
        console.log('Today:', today.toISOString());
        console.log('Four months ago:', fourMonthsAgo.toISOString());
        console.log('Total leads data:', leadsData.length);
        
        leadsData.forEach(lead => {
          if (lead.date) {
            const leadDate = new Date(lead.date);
            if (leadDate >= fourMonthsAgo && leadDate <= today) {
              const dateStr = leadDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              const currentCount = dateMap.get(dateStr) || 0;
              dateMap.set(dateStr, currentCount + 1);
              console.log(`Lead crawled on ${dateStr}:`, lead.date);
            }
          }
        });
        
        const leadsByDateArray = Array.from(dateMap, ([date, count]) => ({ date, count }));
        console.log('Final leads by date:', leadsByDateArray);
        setLeadsByDate(leadsByDateArray);

        // Connection status distribution (pending, scraped, success)
        const statusMap = new Map<string, number>();
        leadsData.forEach(lead => {
          const status = lead.connection_status || 'pending';
          statusMap.set(status, (statusMap.get(status) || 0) + 1);
        });
        setStatusCounts(Array.from(statusMap, ([connection_status, count]) => ({ connection_status, count })));

        // Score distribution by ranges (score is already in percentage)
        const ranges = [
          { range: '0-49%', min: 0, max: 49, color: '#ef4444', count: 0, percentage: 0 },
          { range: '50-79%', min: 50, max: 79, color: '#eab308', count: 0, percentage: 0 },
          { range: '80-100%', min: 80, max: 100, color: '#10b981', count: 0, percentage: 0 }
        ];

        leadsData.forEach(lead => {
          const score = lead.score;
          // Only count if score exists and is not null
          if (score !== null && score !== undefined) {
            if (score < 50) {
              ranges[0].count++;
            } else if (score >= 50 && score < 80) {
              ranges[1].count++;
            } else if (score >= 80) {
              ranges[2].count++;
            }
          }
        });

        console.log('Score ranges:', ranges); // Debug log
        setScoreRanges(ranges);

        // Recent leads (top 5)
        const { data: recentData } = await supabase
          .from('leads_list')
          .select('id, name, connection_status, processed_at, profile_data')
          .order('processed_at', { ascending: false })
          .limit(5);

        setRecentLeads(recentData || []);
        setChartsLoading(false);
      } catch (error) {
        console.error('Error fetching chart data:', error);
        setChartsLoading(false);
      }
    }

    fetchChartData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return 'bg-green-500';
      case 'scraped':
        return 'bg-gray-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return 'bg-green-500/10 text-green-500';
      case 'scraped':
        return 'bg-gray-500/10 text-gray-400';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'failed':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const getStatusPieColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return '#10b981'; // green-500
      case 'scraped':
        return '#6b7280'; // gray-500
      case 'pending':
        return '#eab308'; // yellow-500
      case 'failed':
        return '#ef4444'; // red-500
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopHeader />

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-8 md:px-20 md:py-8 xl:px-40 xl:py-16">
            <div className="mb-10">
              <h1 className="text-4xl font-bold text-white">Dashboard</h1>
              <p className="mt-2 text-base text-gray-400">Analytics overview</p>
            </div>

            {/* Stats Cards */}
            {stats.loading ? (
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3 mb-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-xl bg-[#1a1f2e]" />
                ))}
              </div>
            ) : (
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3 mb-8">
                <StatCard
                  title="Total Leads"
                  value={stats.totalLeads}
                  icon={Users}
                  iconColor="text-blue-500"
                />
                <StatCard
                  title="Total Jobs"
                  value={stats.totalTemplates}
                  icon={FileText}
                  iconColor="text-blue-500"
                />
                <StatCard
                  title="Total Companies"
                  value={stats.totalCompanies}
                  icon={Building2}
                  iconColor="text-blue-500"
                />
              </div>
            )}

            {/* Charts Section */}
            <div className="grid gap-8 md:grid-cols-2 mb-8">
              {/* Leads Trend (Last 4 Months) */}
              <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <h2 className="text-lg font-semibold text-white">Leads Trend (Last 4 Months)</h2>
                </div>
                {chartsLoading ? (
                  <div className="h-48 animate-pulse rounded bg-[#141C33]" />
                ) : leadsByDate.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leadsByDate.map((item, index) => {
                      const maxCount = Math.max(...leadsByDate.map(d => d.count));
                      const percentage = (item.count / maxCount) * 100;
                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">{item.date}</span>
                            <span className="text-white font-medium">{item.count}</span>
                          </div>
                          <div className="h-2 bg-[#141C33] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Connection Status Distribution - Pie Chart */}
              <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                <div className="flex items-center gap-2 mb-6">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <h2 className="text-lg font-semibold text-white">Connection Status</h2>
                </div>
                {chartsLoading ? (
                  <div className="h-48 animate-pulse rounded bg-[#141C33]" />
                ) : statusCounts.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-8">
                    {/* Pie Chart */}
                    <div className="relative w-48 h-48">
                      <svg viewBox="0 0 100 100" className="transform -rotate-90">
                        {(() => {
                          const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
                          let currentAngle = 0;
                          
                          return statusCounts.map((item, index) => {
                            const percentage = (item.count / total) * 100;
                            const angle = (percentage / 100) * 360;
                            const startAngle = currentAngle;
                            const endAngle = currentAngle + angle;
                            
                            // Convert to radians
                            const startRad = (startAngle * Math.PI) / 180;
                            const endRad = (endAngle * Math.PI) / 180;
                            
                            // Calculate arc path
                            const x1 = 50 + 40 * Math.cos(startRad);
                            const y1 = 50 + 40 * Math.sin(startRad);
                            const x2 = 50 + 40 * Math.cos(endRad);
                            const y2 = 50 + 40 * Math.sin(endRad);
                            
                            const largeArc = angle > 180 ? 1 : 0;
                            
                            const pathData = [
                              `M 50 50`,
                              `L ${x1} ${y1}`,
                              `A 40 40 0 ${largeArc} 1 ${x2} ${y2}`,
                              `Z`
                            ].join(' ');
                            
                            currentAngle = endAngle;
                            
                            return (
                              <path
                                key={index}
                                d={pathData}
                                fill={getStatusPieColor(item.connection_status)}
                                className="transition-all duration-300 hover:opacity-80"
                              />
                            );
                          });
                        })()}
                      </svg>
                      {/* Center circle for donut effect */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 rounded-full bg-[#1a1f2e] flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-white">
                              {statusCounts.reduce((sum, s) => sum + s.count, 0)}
                            </p>
                            <p className="text-xs text-gray-400">Total</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="space-y-3">
                      {statusCounts.map((item, index) => {
                        const total = statusCounts.reduce((sum, s) => sum + s.count, 0);
                        const percentage = ((item.count / total) * 100).toFixed(1);
                        return (
                          <div key={index} className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: getStatusPieColor(item.connection_status) }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-gray-300 capitalize text-sm">
                                  {item.connection_status || 'Unknown'}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium text-sm">{item.count}</span>
                                  <span className="text-gray-500 text-xs">({percentage}%)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="grid gap-8 md:grid-cols-2">
              {/* Score Distribution */}
              <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    <h2 className="text-lg font-semibold text-white">Score Distribution</h2>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                    <Percent className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-blue-400">By Percentage</span>
                  </div>
                </div>
                {chartsLoading ? (
                  <div className="h-48 animate-pulse rounded bg-[#141C33]" />
                ) : scoreRanges.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    No data available
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Vertical Bar Chart */}
                    <div className="flex items-end justify-around gap-4 h-48 border-b border-gray-700">
                      {scoreRanges.map((range, index) => {
                        const maxCount = Math.max(...scoreRanges.map(r => r.count), 1);
                        const heightPercentage = (range.count / maxCount) * 100;
                        return (
                          <div key={index} className="flex flex-col items-center flex-1 gap-2 h-full">
                            {/* Bar Container */}
                            <div className="relative w-full flex flex-col justify-end h-full">
                              {range.count > 0 ? (
                                <div
                                  className="w-full rounded-t-lg transition-all duration-500 flex items-start justify-center pt-2"
                                  style={{ 
                                    height: `${heightPercentage}%`,
                                    backgroundColor: range.color
                                  }}
                                >
                                  <span className="text-white text-sm font-bold">
                                    {range.count}
                                  </span>
                                </div>
                              ) : (
                                <div className="w-full h-0" />
                              )}
                            </div>
                            {/* Label */}
                            <div className="text-center pt-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: range.color }}
                                />
                                <span className="text-sm font-medium text-gray-300">{range.range}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 pt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-xs text-gray-400">Low (0-49%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-xs text-gray-400">Medium (50-79%)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-xs text-gray-400">High (80-100%)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
                </div>
                {chartsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-12 animate-pulse rounded bg-[#141C33]" />
                    ))}
                  </div>
                ) : recentLeads.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    No recent activity
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-2.5 rounded-lg bg-[#141C33] hover:bg-gray-700/30 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{lead.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-400 truncate">{lead.profile_data?.company || 'No company'}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(lead.connection_status)}`}>
                              {lead.connection_status || 'pending'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
