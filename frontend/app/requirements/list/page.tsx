'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';
import { RequirementsViewModal } from '@/components/requirements-view-modal';
import { supabase } from '@/lib/supabase';
import { Search, ChevronDown, ChevronUp, Edit, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  job_title: string | null;
  company_id: string | null;
  requirements: any;
  created_at: string;
  companies?: {
    name: string;
  };
}

interface Company {
  id: string;
  name: string;
}

const ITEMS_PER_PAGE_DESKTOP = 10;
const ITEMS_PER_PAGE_MOBILE = 5;

export default function RequirementsListPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingJson, setEditingJson] = useState('');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showCompanyDropdown && !target.closest('.company-dropdown-container')) {
        setShowCompanyDropdown(false);
      }
      if (showSortDropdown && !target.closest('.sort-dropdown-container')) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCompanyDropdown, showSortDropdown]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterAndSort();
  }, [templates, searchQuery, selectedCompany, sortBy, sortOrder]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch templates with company info
      const { data: templatesData, error: templatesError } = await supabase
        .from('search_templates')
        .select(`
          *,
          companies (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (templatesError) throw templatesError;

      // Fetch companies for filter
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (companiesError) throw companiesError;

      setTemplates(templatesData || []);
      setCompanies(companiesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  function filterAndSort() {
    let filtered = [...templates];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.job_title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Company filter
    if (selectedCompany) {
      filtered = filtered.filter(template => template.company_id === selectedCompany);
    }

    // Sort
    if (sortBy === 'name') {
      filtered.sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    } else if (sortBy === 'date') {
      filtered.sort((a, b) => {
        const comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? comparison : -comparison;
      });
    }

    setFilteredTemplates(filtered);
    setCurrentPage(1);
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from('search_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Template deleted successfully');
      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  }

  function handleView(template: Template) {
    setSelectedTemplate(template);
    setShowViewModal(true);
  }

  function handleEdit(template: Template) {
    setSelectedTemplate(template);
    setEditingJson(JSON.stringify(template.requirements, null, 2));
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!selectedTemplate) return;

    try {
      const parsedJson = JSON.parse(editingJson);
      
      const { error } = await supabase
        .from('search_templates')
        .update({ requirements: parsedJson })
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      toast.success('Requirements updated successfully');
      setShowEditModal(false);
      setSelectedTemplate(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating requirements:', error);
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON format');
      } else {
        toast.error('Failed to update requirements');
      }
    }
  }

  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTemplates = filteredTemplates.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopHeader />
        
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-8 md:px-20 md:py-8 xl:px-40 xl:py-16">
            <div className="mb-10">
              <h1 className="text-4xl font-bold text-white">Requirements List</h1>
              <p className="mt-2 text-base text-gray-400">
                Manage all requirement templates ({filteredTemplates.length} total)
              </p>
            </div>

            {/* Search and Filters */}
            <div className="mb-6 flex flex-col md:flex-row gap-4">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or job title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-700 bg-[#1a1f2e] text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="mb-8 flex flex-wrap gap-3">
              {/* Company Filter */}
              <div className="relative company-dropdown-container">
                <button
                  onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
                  className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-3 text-white hover:border-gray-600 focus:border-blue-500 focus:outline-none min-w-[200px] justify-between"
                >
                  <span className="truncate text-sm">
                    {selectedCompany 
                      ? companies.find(c => c.id === selectedCompany)?.name || 'Filter by Company'
                      : 'Filter by Company'}
                  </span>
                  {showCompanyDropdown ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>

                {showCompanyDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-[240px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl z-10">
                    <button
                      onClick={() => {
                        setSelectedCompany('');
                        setShowCompanyDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                        !selectedCompany ? 'bg-gray-700 text-white' : 'text-gray-400'
                      }`}
                    >
                      All Companies
                    </button>
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setSelectedCompany(company.id);
                          setShowCompanyDropdown(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                          selectedCompany === company.id ? 'bg-gray-700 text-white' : 'text-gray-400'
                        }`}
                      >
                        <span className="block truncate">{company.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="relative sort-dropdown-container">
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-3 text-white hover:border-gray-600 focus:border-blue-500 focus:outline-none min-w-[200px] justify-between"
                >
                  <span className="truncate text-sm">
                    {sortBy === 'date' && sortOrder === 'desc' && 'Date (Newest)'}
                    {sortBy === 'date' && sortOrder === 'asc' && 'Date (Oldest)'}
                    {sortBy === 'name' && sortOrder === 'asc' && 'Name (A-Z)'}
                    {sortBy === 'name' && sortOrder === 'desc' && 'Name (Z-A)'}
                    {!sortBy && 'Sort by'}
                  </span>
                  {showSortDropdown ? (
                    <ChevronUp className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>

                {showSortDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-[200px] rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl z-10">
                    <button
                      onClick={() => {
                        if (sortBy === 'date' && sortOrder === 'desc') {
                          setSortBy(null);
                        } else {
                          setSortBy('date');
                          setSortOrder('desc');
                        }
                        setShowSortDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                        sortBy === 'date' && sortOrder === 'desc' ? 'bg-gray-700 text-white' : 'text-gray-400'
                      }`}
                    >
                      Date (Newest)
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === 'date' && sortOrder === 'asc') {
                          setSortBy(null);
                        } else {
                          setSortBy('date');
                          setSortOrder('asc');
                        }
                        setShowSortDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                        sortBy === 'date' && sortOrder === 'asc' ? 'bg-gray-700 text-white' : 'text-gray-400'
                      }`}
                    >
                      Date (Oldest)
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === 'name' && sortOrder === 'asc') {
                          setSortBy(null);
                        } else {
                          setSortBy('name');
                          setSortOrder('asc');
                        }
                        setShowSortDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                        sortBy === 'name' && sortOrder === 'asc' ? 'bg-gray-700 text-white' : 'text-gray-400'
                      }`}
                    >
                      Name (A-Z)
                    </button>
                    <button
                      onClick={() => {
                        if (sortBy === 'name' && sortOrder === 'desc') {
                          setSortBy(null);
                        } else {
                          setSortBy('name');
                          setSortOrder('desc');
                        }
                        setShowSortDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                        sortBy === 'name' && sortOrder === 'desc' ? 'bg-gray-700 text-white' : 'text-gray-400'
                      }`}
                    >
                      Name (Z-A)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="flex flex-col min-h-[50vh]">
              <div className="rounded-xl border border-gray-700 bg-[#1a1f2e] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-700 bg-[#141C33]">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 w-20">No</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Name</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Job Title</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Company</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Requirements</th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <>
                          {Array.from({ length: itemsPerPage }).map((_, i) => (
                            <tr key={i} className="border-b border-gray-700/50">
                              <td className="px-6 py-4">
                                <div className="h-3 w-8 animate-pulse rounded bg-gray-700" />
                              </td>
                              <td className="px-6 py-4">
                                <div className="h-4 w-48 animate-pulse rounded bg-gray-700" />
                              </td>
                              <td className="px-6 py-4">
                                <div className="h-4 w-32 animate-pulse rounded bg-gray-700" />
                              </td>
                              <td className="px-6 py-4">
                                <div className="h-4 w-24 animate-pulse rounded bg-gray-700" />
                              </td>
                              <td className="px-6 py-4">
                                <div className="h-4 w-16 animate-pulse rounded bg-gray-700" />
                              </td>
                              <td className="px-6 py-4">
                                <div className="h-4 w-20 animate-pulse rounded bg-gray-700" />
                              </td>
                            </tr>
                          ))}
                        </>
                      ) : filteredTemplates.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-20">
                            <div className="flex flex-col items-center justify-center">
                              <div className="mb-6">
                                <img 
                                  src="/logo_without_bg.png" 
                                  alt="Logo" 
                                  className="w-16 h-16 opacity-30"
                                />
                              </div>
                              <p className="text-lg text-gray-400">No templates found</p>
                              <p className="mt-2 text-sm text-gray-500">Try adjusting your search or filters</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {paginatedTemplates.map((template, index) => {
                            const rowNumber = startIndex + index + 1;
                            const hasRequirements = template.requirements && 
                              template.requirements.requirements && 
                              template.requirements.requirements.length > 0;
                            
                            return (
                              <tr 
                                key={template.id} 
                                className="border-b border-gray-700/50 transition-colors hover:bg-gray-700/30"
                              >
                                <td className="px-6 py-4 text-sm text-gray-500">{rowNumber}</td>
                                <td className="px-6 py-4 text-white font-medium">{template.name}</td>
                                <td className="px-6 py-4 text-gray-400 text-sm">
                                  {template.job_title || '-'}
                                </td>
                                <td className="px-6 py-4 text-gray-400 text-sm">
                                  {template.companies?.name || '-'}
                                </td>
                                <td className="px-6 py-4">
                                  {hasRequirements ? (
                                    <button
                                      onClick={() => handleView(template)}
                                      className="text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors"
                                    >
                                      View
                                    </button>
                                  ) : (
                                    <span className="text-sm text-gray-500">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => handleEdit(template)}
                                      className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-gray-700 text-white"
                                      title="Edit Requirements"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(template.id)}
                                      className="rounded-md border border-gray-700 p-2 transition-colors hover:border-red-800 hover:bg-red-950 text-white"
                                      title="Delete Template"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <div className="mt-auto pt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-2 text-gray-400 transition-all hover:bg-gray-700 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-w-[40px] rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                              : 'border border-gray-700 bg-[#1a1f2e] text-gray-400 hover:bg-gray-700 hover:border-gray-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    {totalPages > 5 && (
                      <>
                        <span className="px-2 text-gray-500">...</span>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          className={`min-w-[40px] rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                            currentPage === totalPages
                              ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                              : 'border border-gray-700 bg-[#1a1f2e] text-gray-400 hover:bg-gray-700 hover:border-gray-600'
                          }`}
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-2 text-gray-400 transition-all hover:bg-gray-700 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* View Requirements Modal */}
      {selectedTemplate && showViewModal && (
        <RequirementsViewModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedTemplate(null);
          }}
          templateName={selectedTemplate.name}
          requirements={selectedTemplate.requirements}
        />
      )}

      {/* Edit JSON Modal */}
      {selectedTemplate && showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-700 p-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Edit Requirements (JSON)</h2>
                <p className="text-sm text-gray-400 mt-1">{selectedTemplate.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTemplate(null);
                }}
                className="rounded-md p-1 transition-colors hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <textarea
                value={editingJson}
                onChange={(e) => setEditingJson(e.target.value)}
                className="w-full h-full min-h-[400px] rounded-md border border-gray-700 bg-[#141C33] px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-sm resize-none"
                placeholder="Enter JSON..."
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-700 p-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedTemplate(null);
                }}
                className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Delete Template</h3>
              <p className="text-sm text-gray-400 mb-6">
                Are you sure you want to delete this template? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
