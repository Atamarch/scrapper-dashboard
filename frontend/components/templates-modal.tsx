'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, type Template } from '@/lib/supabase';
import { X, Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

interface TemplatesModalProps {
  companyId: string;
  companyName: string;
  isOpen: boolean;
  onClose: () => void;
}

const ITEMS_PER_PAGE = 6;

export function TemplatesModal({ companyId, companyName, isOpen, onClose }: TemplatesModalProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && companyId) {
      fetchTemplates();
    }
  }, [isOpen, companyId]);

  useEffect(() => {
    const filtered = templates.filter(template =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.job_title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredTemplates(filtered);
    setCurrentPage(1);
  }, [searchQuery, templates]);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('search_templates')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching templates in modal:', error);
      } else {
        console.log('Templates in modal:', data);
        setTemplates(data || []);
        setFilteredTemplates(data || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleViewLeads = (templateId: string) => {
    router.push(`/leads?template=${templateId}`);
    onClose();
  };

  const toggleNoteExpansion = (templateId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  if (!isOpen) return null;

  const totalPages = Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTemplates = filteredTemplates.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-5xl max-h-[80vh] overflow-hidden rounded-xl border border-gray-700 bg-[#0f1419]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-[#1a1f2e] p-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Requirements - {companyName}</h2>
            <p className="mt-1 text-sm text-gray-400">{filteredTemplates.length} templates found</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search templates by name or job title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-[#1a1f2e] py-2.5 pl-10 pr-4 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:min-h-150 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-xl border border-gray-700 bg-[#1a1f2e] p-6">
                  <div className="mb-4 flex h-12 w-12 animate-pulse rounded-lg bg-gray-700" />
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-700" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-700" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-gray-700" />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-gray-700 pt-4">
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-700" />
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-700" />
                  </div>
                </div>

              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-600" />
              <p className="mt-4 text-gray-400">No templates found</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-flip-in">
                {paginatedTemplates.map((template) => {
                  const isExpanded = expandedNotes.has(template.id);
                  const hasLongNote = template.note && template.note.length > 100;
                  
                  return (
                  <div
                    key={template.id}
                    className="rounded-xl min-h-80 border border-gray-700 bg-[#1a1f2e] p-5 transition-all hover:border-gray-600 flex flex-col"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </div>

                    <h3 className="mb-2 text-base font-semibold text-white line-clamp-1">{template.name}</h3>
                    {template.job_title && (
                      <p className="mb-2 text-sm text-gray-500">{template.job_title}</p>
                    )}
                    {template.note && (
                      <div className="mb-3 flex-1">
                        <div 
                          className={`text-sm text-gray-400 overflow-y-auto ${
                            isExpanded ? 'max-h-23' : 'line-clamp-2'
                          }`}
                          style={isExpanded ? { scrollbarWidth: 'thin', scrollbarColor: '#4B5563 #1a1f2e' } : {}}
                        >
                          {template.note}
                        </div>
                        {hasLongNote && (
                          <button
                            onClick={() => toggleNoteExpansion(template.id)}
                            className="mt-1 text-xs text-blue-500 hover:text-blue-400 transition-colors"
                          >
                            {isExpanded ? 'Show Less' : 'Show More'}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-gray-700 pt-3 mt-auto">
                      <span className="text-xs text-gray-500">
                        {new Date(template.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        onClick={() => handleViewLeads(template.id)}
                        className="text-sm font-medium text-blue-500 transition-colors hover:text-blue-400"
                      >
                        View Leads
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-gray-700 px-3 py-2 text-gray-400 transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`rounded-lg px-3 py-2 text-sm transition-colors ${currentPage === pageNum
                            ? 'bg-blue-500 text-white'
                            : 'border border-gray-700 text-gray-400 hover:bg-gray-800'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {totalPages > 5 && (
                    <>
                      <span className="text-gray-400">...</span>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-800"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-gray-700 px-3 py-2 text-gray-400 transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
