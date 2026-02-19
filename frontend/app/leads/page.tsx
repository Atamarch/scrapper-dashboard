'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { supabase, type Lead, type Template } from '@/lib/supabase';
import { ExternalLink, ChevronLeft, ChevronRight, Download, ChevronDown, ChevronUp } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

function LeadsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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
        setTemplates(data || []);
      }
    }
    fetchTemplates();
  }, []);

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      try {
        // Jika belum pilih template, jangan fetch data
        if (!selectedTemplate) {
          setLeads([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }

        // Fetch all data in batches (karena data > 1000)
        let allData: Lead[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        let baseQuery = supabase.from('leads_list').select('*');
        
        // Filter berdasarkan template yang dipilih
        baseQuery = baseQuery.eq('template_id', selectedTemplate);

        // Fetch in batches
        while (hasMore) {
          const { data: batchData, error: batchError } = await baseQuery
            .order(sortBy, { ascending: sortOrder === 'asc' })
            .range(from, from + batchSize - 1);

          if (batchError) {
            console.error('Error fetching leads:', batchError);
            break;
          }

          if (batchData && batchData.length > 0) {
            allData = [...allData, ...batchData];
            from += batchSize;
            
            if (batchData.length < batchSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        setTotalCount(allData.length);

        // Paginate
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const paginatedLeads = allData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        
        setLeads(paginatedLeads);
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();
  }, [currentPage, selectedTemplate, sortBy, sortOrder]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    setCurrentPage(1);
    setShowTemplateDropdown(false);
    if (templateId) {
      router.push(`/leads?template=${templateId}`);
    } else {
      router.push('/leads');
    }
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      // Fetch all data in batches
      let allData: Lead[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      let query = supabase.from('leads_list').select('*');

      // Filter berdasarkan template yang dipilih (export CSV)
      query = query.eq('template_id', selectedTemplate);

      while (hasMore) {
        const { data: batchData, error: batchError } = await query
          .order('date', { ascending: false })
          .range(from, from + batchSize - 1);

        if (batchError) throw batchError;

        if (batchData && batchData.length > 0) {
          allData = [...allData, ...batchData];
          from += batchSize;
          
          if (batchData.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      if (allData.length === 0) {
        alert('No data to export');
        return;
      }

      const headers = ['Name', 'Date', 'Connection Status', 'Score', 'Scored At', 'Note Sent', 'Profile URL', 'Search URL'];
      const csvRows = [headers.join(',')];

      allData.forEach(lead => {
        const row = [
          `"${lead.name || ''}"`,
          lead.date || '',
          lead.connection_status || '',
          lead.score || '',
          lead.scored_at || '',
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

      const templateName = templates.find(t => t.id === selectedTemplate)?.name || 'unknown';
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
      // Fetch all data in batches
      let allData: Lead[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      let query = supabase.from('leads_list').select('*');

      // Filter berdasarkan template yang dipilih (export JSON)
      query = query.eq('template_id', selectedTemplate);

      while (hasMore) {
        const { data: batchData, error: batchError } = await query
          .order('date', { ascending: false })
          .range(from, from + batchSize - 1);

        if (batchError) throw batchError;

        if (batchData && batchData.length > 0) {
          allData = [...allData, ...batchData];
          from += batchSize;
          
          if (batchData.length < batchSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      if (allData.length === 0) {
        alert('No data to export');
        return;
      }

      const jsonContent = JSON.stringify(allData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      const templateName = templates.find(t => t.id === selectedTemplate)?.name || 'unknown';
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
          <div className="mb-8 p-1 rounded-xl bg-gradient-to-r from-[#1F2B4D] to-transparent">
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#141C33] to-transparent">
              <h1 className="text-3xl font-bold text-white">Leads</h1>
              <p className="mt-1 text-gray-400">Select a template to view leads</p>
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-slate-800 p-2 rounded-xl text-sm text-gray-400">Filter by Template</span>:
              <div className="relative">
                <button
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-2 text-white hover:border-gray-600 focus:border-blue-500 focus:outline-none min-w-[200px] justify-between"
                >
                  <span className="truncate">
                    {selectedTemplate 
                      ? templates.find(t => t.id === selectedTemplate)?.name || 'Select Template'
                      : 'Select Template'}
                  </span>
                  {showTemplateDropdown ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>

                {showTemplateDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-full min-w-[300px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-lg z-10">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateChange(template.id)}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700/50 ${
                          selectedTemplate === template.id ? 'bg-gray-700/50 text-white' : 'text-gray-400'
                        }`}
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span className="bg-slate-800 p-2 rounded-xl text-sm text-gray-400">Sort by</span>:
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-') as ['date' | 'score', 'asc' | 'desc'];
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder);
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-2 text-white hover:border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="date-desc">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="score-desc">Score (High to Low)</option>
                <option value="score-asc">Score (Low to High)</option>
              </select>
            </div>

            <div className="relative export-menu-container">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exporting || totalCount === 0 || !selectedTemplate}
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

          <div className="rounded-xl bg-gradient-to-r from-[#233567] to-[#324886] p-6 mb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Leads List</h2>
              <span className="text-sm text-gray-400">{totalCount} leads</span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-[#1a1f2e]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Score</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Scored At</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Note Sent</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Profile</th>
                  </tr>
                </thead>
                <tbody className="bg-[#202531]">
                  {loading ? (
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} className="border-b border-gray-700/50">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="space-y-2">
                              <div className="h-3 w-3/4 animate-pulse rounded bg-gray-700" />
                              <div className="h-2 w-1/2 animate-pulse rounded bg-gray-700" />
                              <div className="h-2 w-2/3 animate-pulse rounded bg-gray-700" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20">
                        <div className="flex flex-col items-center justify-center">
                          <div className="mb-6">
                            <img 
                              src="/logo_without_bg.png" 
                              alt="Logo" 
                              className="w-16 h-16 opacity-30"
                            />
                          </div>
                          <p className="text-lg text-gray-400">
                            {!selectedTemplate ? 'Please select a template to view leads' : 'No leads found'}
                          </p>
                          <p className="mt-2 text-sm text-gray-500">
                            {!selectedTemplate ? 'Choose a template from the dropdown above' : 'Try adjusting your filter'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
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
                        <td className="px-6 py-4">
                          <span className={`font-semibold ${
                            lead.score != null && lead.score >= 80
                              ? 'text-green-500'
                              : lead.score != null && lead.score >= 50
                                ? 'text-yellow-500'
                                : lead.score != null
                                  ? 'text-red-500'
                                  : 'text-gray-500'
                            }`}>
                            {lead.score != null ? lead.score.toFixed(1) : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          {lead.scored_at ? (
                            new Date(lead.scored_at).toLocaleDateString('en-GB', { 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric'
                            })
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-400">
                          <span className="line-clamp-1" title={lead.note_sent || '-'}>
                            {lead.note_sent || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {lead.profile_url ? (
                            <a
                              href={lead.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 border-t rounded-xl bg-[#1a1f2e] border-gray-700 p-6">
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
