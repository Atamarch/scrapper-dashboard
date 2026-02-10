'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { supabase, type Lead, type Template } from '@/lib/supabase';
import { ExternalLink, ChevronLeft, ChevronRight, Download } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

function LeadsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
    const templateId = searchParams.get('template');
    if (templateId) {
      setSelectedTemplate(templateId);
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchTemplates() {
      const { data, error } = await supabase.from('search_templates').select('*').order('name');
      if (error) {
        console.error('Error fetching templates:', error);
      } else {
        console.log('Templates data:', data);
        setTemplates(data || []);
      }
    }
    fetchTemplates();
  }, []);

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      try {
        let query = supabase.from('leads_list').select('*', { count: 'exact' });

        if (selectedTemplate !== 'all') {
          query = query.eq('template_id', selectedTemplate);
        }

        const { data, count, error } = await query
          .order('date', { ascending: false })
          .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1);

        if (error) {
          console.error('Error fetching leads:', error);
        } else {
          console.log('Leads data:', data);
          setLeads(data || []);
          setTotalCount(count || 0);
        }
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();
  }, [currentPage, selectedTemplate]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    setCurrentPage(1);
    if (templateId === 'all') {
      router.push('/leads');
    } else {
      router.push(`/leads?template=${templateId}`);
    }
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      let query = supabase.from('leads_list').select('*');

      if (selectedTemplate !== 'all') {
        query = query.eq('template_id', selectedTemplate);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No data to export');
        return;
      }

      const headers = ['Name', 'Date', 'Connection Status', 'Note Sent', 'Profile URL', 'Search URL'];
      const csvRows = [headers.join(',')];

      data.forEach(lead => {
        const row = [
          `"${lead.name || ''}"`,
          lead.date || '',
          lead.connection_status || '',
          `"${lead.note_sent || ''}"`,
          lead.profile_url || '',
          lead.search_url || ''
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const templateName = templates.find(t => t.id === selectedTemplate)?.name || 'all';
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_${templateName}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  const exportToJSON = async () => {
    setExporting(true);
    try {
      let query = supabase.from('leads_list').select('*');

      if (selectedTemplate !== 'all') {
        query = query.eq('template_id', selectedTemplate);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No data to export');
        return;
      }

      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const templateName = templates.find(t => t.id === selectedTemplate)?.name || 'all';
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_${templateName}_${new Date().toISOString().split('T')[0]}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export JSON');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-[#141C33] to-transparent">            
            <h1 className="text-3xl font-bold text-white">Leads</h1>
            <p className="mt-1 text-gray-400">Select a template to view leads</p>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Filter by Template:</span>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Templates</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative export-menu-container">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting || totalCount === 0}
                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#1A2E1C] px-4 py-2 text-white transition-colors hover:bg-[#2A472C] disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting...' : 'Export'}
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-gray-700 bg-[#141A14] shadow-lg z-10">
                  <button
                    onClick={exportToCSV}
                    className="w-full px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-[#2F6A32] rounded-t-lg"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={exportToJSON}
                    className="w-full px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-[#817F37] rounded-b-lg"
                  >
                    Export as JSON
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-[#2D3C67] p-6 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Leads List</h2>
              <span className="text-sm text-gray-400">{totalCount} leads</span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 ">
            {loading ? (
              <div className="p-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="mb-4 h-16 animate-pulse rounded-lg bg-gray-800" />
                ))}
              </div>
            ) : (
              <div className="animate-flip-in overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-700 bg-[#1a1f2e]">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Date</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Note Sent</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#202531]">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-700/50 transition-colors hover:bg-gray-800/30">
                        <td className="px-6 py-4 text-white">{lead.name}</td>
                        <td className="px-6 py-4 text-gray-400">
                          {new Date(lead.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${lead.connection_status === 'connected'
                            ? 'bg-green-500/10 text-green-500'
                            : lead.connection_status === 'pending'
                              ? 'bg-yellow-500/10 text-yellow-500'
                              : 'bg-gray-500/10 text-gray-500'
                            }`}>
                            {lead.connection_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          <span className="line-clamp-1" title={lead.note_sent}>
                            {lead.note_sent}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={lead.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 border-t bg-[#1a1f2e] border-gray-700 p-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-gray-400 transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`rounded-lg px-4 py-2 transition-colors ${currentPage === pageNum
                        ? 'bg-blue-500 text-white'
                        : 'border border-gray-700 text-gray-400 hover:bg-gray-800'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <>
                    <span className="text-gray-400">...</span>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className="rounded-lg border border-gray-700 px-4 py-2 text-gray-400 transition-colors hover:bg-gray-800"
                    >
                      {totalPages}
                    </button>
                  </>
                )}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-gray-400 transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

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
      <LeadsPageContent />
    </Suspense>
  );
}
