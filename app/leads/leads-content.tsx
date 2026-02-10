'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { supabase, type Lead, type Template } from '@/lib/supabase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 10;

export default function LeadsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');

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

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white">Leads</h1>
            <p className="mt-1 text-gray-400">Select a template to view leads</p>
          </div>

          <div className="mb-6 flex items-center gap-3">
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

          <div className="rounded-xl border border-gray-700 bg-[#1a1f2e]">
            <div className="border-b border-gray-700 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Leads List</h2>
            </div>

            {loading ? (
              <div className="p-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="mb-4 h-16 animate-pulse rounded-lg bg-gray-800" />
                ))}
              </div>
            ) : (
              <div className="animate-flip-in overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-700/50 transition-colors hover:bg-gray-800/30">
                        <td className="px-6 py-4 text-white">{lead.name}</td>
                        <td className="px-6 py-4 text-gray-400">
                          {new Date(lead.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                            lead.connection_status === 'connected' 
                              ? 'bg-green-500/10 text-green-500'
                              : lead.connection_status === 'pending'
                              ? 'bg-yellow-500/10 text-yellow-500'
                              : 'bg-gray-500/10 text-gray-500'
                          }`}>
                            {lead.connection_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-700 px-6 py-4">
              <span className="text-sm text-gray-400">Total: {totalCount} leads</span>
              
              {!loading && totalPages > 1 && (
                <div className="flex items-center gap-2">
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
                        className={`rounded-lg px-4 py-2 transition-colors ${
                          currentPage === pageNum
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
        </div>
      </main>
    </div>
  );
}
