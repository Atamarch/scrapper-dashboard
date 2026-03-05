'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';
import { supabase, type Lead, type Template } from '@/lib/supabase';
import { ExternalLink, ChevronLeft, ChevronRight, Download, ChevronDown, ChevronUp, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const ITEMS_PER_PAGE_DESKTOP = 10;
const ITEMS_PER_PAGE_MOBILE = 5;

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
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'processed_at' | 'score'>('processed_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([]);
  const [showRequirementsFilter, setShowRequirementsFilter] = useState(false);
  const [templateRequirements, setTemplateRequirements] = useState<any[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    requirements: false,
    scoringResult: false,
    profileData: false,
    outreachMessage: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Reset dropdown saat modal ditutup atau ganti profile
  useEffect(() => {
    if (!showDetailModal || !selectedLead) {
      // Reset semua dropdown ke tertutup
      setExpandedSections({
        requirements: false,
        scoringResult: false,
        profileData: false,
        outreachMessage: false
      });
    }
  }, [showDetailModal, selectedLead?.id]); // Trigger saat modal tutup atau ganti lead

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
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
      if (showTemplateDropdown && !target.closest('.template-dropdown-container')) {
        setShowTemplateDropdown(false);
      }
      if (showSortDropdown && !target.closest('.sort-dropdown-container')) {
        setShowSortDropdown(false);
      }
      if (showRequirementsFilter && !target.closest('.requirements-filter-container')) {
        setShowRequirementsFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu, showTemplateDropdown, showSortDropdown, showRequirementsFilter]);

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

  // Fetch template requirements when template changes
  useEffect(() => {
    async function fetchTemplateRequirements() {
      // Always fetch requirements, even if no template selected
      if (!selectedTemplate) {
        setTemplateRequirements([]);
        setSelectedRequirements([]);
        return;
      }

      const { data, error } = await supabase
        .from('search_templates')
        .select('requirements')
        .eq('id', selectedTemplate)
        .single();

      if (error) {
        console.error('Error fetching template requirements:', error);
        setTemplateRequirements([]);
      } else if (data?.requirements?.requirements) {
        setTemplateRequirements(data.requirements.requirements);
      } else {
        setTemplateRequirements([]);
      }
    }
    fetchTemplateRequirements();
  }, [selectedTemplate]);

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

        // Filter by search query
        let filteredData = allData;
        if (searchQuery.trim()) {
          filteredData = allData.filter(lead => 
            lead.name?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        // Filter by selected requirements
        if (selectedRequirements.length > 0) {
          filteredData = filteredData.filter(lead => {
            if (!lead.scoring_data?.results) return false;
            
            // Check if lead matches ALL selected requirements
            const results = lead.scoring_data.results;
            return selectedRequirements.every(reqId => {
              const result = results.find((r: any) => r.id === reqId);
              return result && result.matched === true;
            });
          });
        }

        setTotalCount(filteredData.length);

        // Paginate
        const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedLeads = filteredData.slice(startIndex, startIndex + itemsPerPage);
        
        setLeads(paginatedLeads);
      } catch (error) {
        console.error('Error fetching leads:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();
  }, [currentPage, selectedTemplate, sortBy, sortOrder, searchQuery, selectedRequirements, isMobile]);

  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    setCurrentPage(1);
    setShowTemplateDropdown(false);
    setSelectedLeads([]);
    setSelectAll(false);
    setSelectedRequirements([]); // Reset requirements filter
    if (templateId) {
      router.push(`/leads?template=${templateId}`);
    } else {
      router.push('/leads');
    }
  };

  const handleToggleRequirement = (reqId: string) => {
    setSelectedRequirements(prev => {
      if (prev.includes(reqId)) {
        return prev.filter(id => id !== reqId);
      } else {
        return [...prev, reqId];
      }
    });
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleSelectAll = () => {
    if (selectAll) {
      // Unselect all leads on current page
      const currentPageLeadIds = leads.map(lead => lead.id);
      setSelectedLeads(selectedLeads.filter(id => !currentPageLeadIds.includes(id)));
      setSelectAll(false);
    } else {
      // Select all leads on current page
      const currentPageLeadIds = leads.map(lead => lead.id);
      const newSelected = [...new Set([...selectedLeads, ...currentPageLeadIds])];
      setSelectedLeads(newSelected);
      setSelectAll(true);
    }
  };

  const handleSelectLead = (leadId: string) => {
    if (selectedLeads.includes(leadId)) {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
      setSelectAll(false);
    } else {
      const newSelected = [...selectedLeads, leadId];
      setSelectedLeads(newSelected);
      // Check if all leads on current page are selected
      const currentPageLeadIds = leads.map(lead => lead.id);
      const allCurrentPageSelected = currentPageLeadIds.every(id => newSelected.includes(id));
      setSelectAll(allCurrentPageSelected);
    }
  };

  // Update selectAll checkbox state when page changes
  useEffect(() => {
    if (leads.length > 0) {
      const currentPageLeadIds = leads.map(lead => lead.id);
      const allCurrentPageSelected = currentPageLeadIds.every(id => selectedLeads.includes(id));
      setSelectAll(allCurrentPageSelected);
    } else {
      setSelectAll(false);
    }
  }, [leads, selectedLeads]);

  const handleSendOutreach = async () => {
    // Prevent multiple clicks - check state first
    if (sendingOutreach) return;
    
    if (selectedLeads.length === 0) {
      toast.error('No leads selected');
      return;
    }

    // Check if template is selected
    if (!selectedTemplate) {
      toast.error('No template selected');
      return;
    }

    // Set loading state after all validations
    setSendingOutreach(true);
    
    try {
      // Fetch all selected leads data from database (not just current page)
      console.log('📋 Fetching selected leads data from database...');
      const { data: selectedLeadsData, error: leadsError } = await supabase
        .from('leads_list')
        .select('id, name, profile_url')
        .in('id', selectedLeads);

      if (leadsError || !selectedLeadsData) {
        console.error('❌ Error fetching leads:', leadsError);
        toast.error('Failed to fetch selected leads');
        setSendingOutreach(false);
        return;
      }

      console.log(`✅ Fetched ${selectedLeadsData.length} leads from database`);

      // Fetch template note from database
      console.log('📋 Fetching template note from database...');
      const { data: templateData, error: templateError } = await supabase
        .from('search_templates')
        .select('note')
        .eq('id', selectedTemplate)
        .single();

      if (templateError || !templateData) {
        console.error('❌ Error fetching template:', templateError);
        toast.error('Failed to fetch message template');
        setSendingOutreach(false);
        return;
      }

      const messageTemplate = templateData.note;
      
      if (!messageTemplate) {
        toast.error('Template has no message configured');
        setSendingOutreach(false);
        return;
      }

      console.log('✅ Template note fetched:', messageTemplate.substring(0, 50) + '...');

      // Prepare payload
      const payload = {
        leads: selectedLeadsData.map(lead => ({
          id: lead.id,
          name: lead.name,
          profile_url: lead.profile_url
        })),
        message: messageTemplate, // Use template note from database
        dry_run: false // Set to true for testing
      };

      // Log payload for debugging
      console.log('📤 Sending outreach payload:', payload);
      console.log(`Total leads: ${payload.leads.length}`);

      // Get API URL from env
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      
      console.log(`🔗 API URL: ${apiUrl}`);

      // Send to API
      const response = await fetch(`${apiUrl}/api/outreach/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to send outreach');
      }

      console.log('✅ API Response:', result);
      toast.success(`Outreach queued for ${result.count} lead(s)!`);
      
      // Clear selection after successful send
      setSelectedLeads([]);
      setSelectAll(false);

    } catch (error) {
      console.error('❌ Error sending outreach:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to send outreach: ${errorMessage}`);
    } finally {
      setSendingOutreach(false);
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
        toast.error('No data to export');
        return;
      }

      const headers = ['Name', 'Connection Status', 'Score', 'Scored At', 'Profile URL', 'Search URL'];
      const csvRows = [headers.join(',')];

      allData.forEach(lead => {
        const row = [
          `"${lead.name || ''}"`,
          lead.connection_status || '',
          lead.score || '',
          lead.scored_at || '',
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
      toast.success('CSV exported successfully!');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
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
        toast.error('No data to export');
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
      toast.success('JSON exported successfully!');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      toast.error('Failed to export JSON');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
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
              <h1 className="text-4xl font-bold text-white">Leads</h1>
              <p className="mt-2 text-base text-gray-400">Select a template to view leads</p>
            </div>

          {/* Row 1: Search + Action Buttons */}
          <div className="mb-6 flex flex-col md:flex-row gap-4">
            {/* Search Bar - Full Width */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-700 bg-[#1a1f2e] text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {/* Send Outreach Button */}
              <button
                onClick={handleSendOutreach}
                disabled={selectedLeads.length === 0 || sendingOutreach}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                title={selectedLeads.length === 0 ? 'Select leads to send outreach' : `Send outreach to ${selectedLeads.length} selected lead(s)`}
              >
                {sendingOutreach ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Sending...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden sm:inline">Send</span>
                    {selectedLeads.length > 0 && <span className="hidden md:inline">({selectedLeads.length})</span>}
                  </>
                )}
              </button>

              {/* Export Button */}
              <div className="relative export-menu-container">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={exporting || totalCount === 0 || !selectedTemplate}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-white transition-all hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl z-10">
                    <button
                      onClick={exportToCSV}
                      className="w-full px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-gray-700 rounded-t-lg"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={exportToJSON}
                      className="w-full px-4 py-2.5 text-left text-sm text-white transition-colors hover:bg-gray-700 rounded-b-lg"
                    >
                      Export as JSON
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Filter Dropdowns */}
          <div className="mb-8 flex flex-wrap gap-3">
            {/* Template Filter */}
            <div className="relative template-dropdown-container">
              <button
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-3 text-white hover:border-gray-600 focus:border-blue-500 focus:outline-none min-w-[200px] justify-between"
              >
                <span className="truncate text-sm">
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
                <div className="absolute top-full left-0 mt-2 w-[240px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl z-10">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateChange(template.id)}
                      className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                        selectedTemplate === template.id ? 'bg-gray-700 text-white' : 'text-gray-400'
                      }`}
                    >
                      <span className="block truncate">{template.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort Filter */}
            <div className="relative sort-dropdown-container">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-3 text-white hover:border-gray-600 focus:border-blue-500 focus:outline-none min-w-[200px] justify-between"
              >
                <span className="truncate text-sm">
                  {sortBy === 'processed_at' && sortOrder === 'desc' && 'Processed At (Newest)'}
                  {sortBy === 'processed_at' && sortOrder === 'asc' && 'Processed At (Oldest)'}
                  {sortBy === 'score' && sortOrder === 'desc' && 'Score (High to Low)'}
                  {sortBy === 'score' && sortOrder === 'asc' && 'Score (Low to High)'}
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
                      setSortBy('processed_at');
                      setSortOrder('desc');
                      setCurrentPage(1);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                      sortBy === 'processed_at' && sortOrder === 'desc' ? 'bg-gray-700 text-white' : 'text-gray-400'
                    }`}
                  >
                    Processed At (Newest)
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('processed_at');
                      setSortOrder('asc');
                      setCurrentPage(1);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                      sortBy === 'processed_at' && sortOrder === 'asc' ? 'bg-gray-700 text-white' : 'text-gray-400'
                    }`}
                  >
                    Processed At (Oldest)
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('score');
                      setSortOrder('desc');
                      setCurrentPage(1);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                      sortBy === 'score' && sortOrder === 'desc' ? 'bg-gray-700 text-white' : 'text-gray-400'
                    }`}
                  >
                    Score (High to Low)
                  </button>
                  <button
                    onClick={() => {
                      setSortBy('score');
                      setSortOrder('asc');
                      setCurrentPage(1);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700 ${
                      sortBy === 'score' && sortOrder === 'asc' ? 'bg-gray-700 text-white' : 'text-gray-400'
                    }`}
                  >
                    Score (Low to High)
                  </button>
                </div>
              )}
            </div>

            {/* Requirements Filter - Always visible */}
            <div className="relative requirements-filter-container">
              <button
                onClick={() => setShowRequirementsFilter(!showRequirementsFilter)}
                disabled={!selectedTemplate}
                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-3 text-white hover:border-gray-600 focus:border-blue-500 focus:outline-none min-w-[200px] justify-between disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="truncate text-sm">
                  {!selectedTemplate ? 'Requirements' : selectedRequirements.length === 0 ? 'Requirements' : `Requirements (${selectedRequirements.length})`}
                </span>
                {showRequirementsFilter ? (
                  <ChevronUp className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                )}
              </button>

              {showRequirementsFilter && selectedTemplate && (
                <div className="absolute top-full left-0 mt-2 w-[320px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl z-10">
                  {templateRequirements.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-sm text-gray-400">No requirements available for this template</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 border-b border-gray-700 bg-[#141C33]">
                        <p className="text-xs text-gray-400">Select requirements to filter leads</p>
                      </div>
                      <div className="p-2 space-y-1">
                        {templateRequirements.map((req) => (
                          <label
                            key={req.id}
                            className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-gray-700/30 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedRequirements.includes(req.id)}
                              onChange={() => handleToggleRequirement(req.id)}
                              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white break-words">{req.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Type: <span className="text-gray-400">{req.type}</span>
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                      {selectedRequirements.length > 0 && (
                        <div className="p-2 border-t border-gray-700 bg-[#141C33]">
                          <button
                            onClick={() => {
                              setSelectedRequirements([]);
                              setCurrentPage(1);
                            }}
                            className="w-full px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            Clear all filters
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col min-h-[50vh]">
            <div className="rounded-xl border border-gray-700 bg-[#1a1f2e] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-700 bg-[#141C33]">
                    <tr>
                      <th className="px-4 py-4 text-left w-12">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                          disabled={leads.length === 0}
                          className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </th>
                      <th className="px-3 py-4 text-left text-sm font-medium text-gray-400 w-16">No</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Score</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Processed At</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <>
                        {Array.from({ length: itemsPerPage }).map((_, i) => (
                          <tr key={i} className="border-b border-gray-700/50">
                            <td className="px-4 py-4">
                              <div className="h-4 w-4 animate-pulse rounded bg-gray-700" />
                            </td>
                            <td className="px-3 py-4">
                              <div className="h-3 w-8 animate-pulse rounded bg-gray-700" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-48 animate-pulse rounded bg-gray-700" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-6 w-20 animate-pulse rounded-full bg-gray-700" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-16 animate-pulse rounded bg-gray-700" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-24 animate-pulse rounded bg-gray-700" />
                            </td>
                            <td className="px-6 py-4">
                              <div className="h-4 w-20 animate-pulse rounded bg-gray-700" />
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
                        {leads.map((lead, index) => {
                          const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
                          const isSelected = selectedLeads.includes(lead.id);
                          return (
                            <tr 
                              key={lead.id} 
                              className={`border-b border-gray-700/50 transition-colors ${
                                isSelected ? 'bg-blue-500/5' : 'hover:bg-gray-700/30'
                              }`}
                            >
                              <td className="px-4 py-4">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSelectLead(lead.id)}
                                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer transition-all hover:border-blue-500"
                                />
                              </td>
                              <td className="px-3 py-4 text-sm text-gray-500">{rowNumber}</td>
                              <td className="px-6 py-4 text-white font-medium">{lead.name}</td>
                              <td className="px-6 py-4">
                                <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  lead.connection_status === 'connected' || lead.connection_status === 'success'
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
                                  {lead.score != null ? `${lead.score.toFixed(1)}%` : '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-400 text-sm">
                                {lead.processed_at ? (
                                  new Date(lead.processed_at).toLocaleDateString('en-GB', { 
                                    day: 'numeric', 
                                    month: 'short', 
                                    year: 'numeric'
                                  })
                                ) : (
                                  <span className="text-gray-500">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {lead.profile_url ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLead(lead);
                                      setShowDetailModal(true);
                                    }}
                                    className="text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors"
                                  >
                                    View
                                  </button>
                                ) : (
                                  <span className="text-sm text-gray-500">-</span>
                                )}
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

            {/* Pagination - Always at bottom */}
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

                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="px-2 text-gray-500">...</span>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        className="min-w-[40px] rounded-lg border border-gray-700 bg-[#1a1f2e] px-4 py-2 text-sm font-medium text-gray-400 transition-all hover:bg-gray-700 hover:border-gray-600"
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

      {/* Detail Modal */}
      {showDetailModal && selectedLead && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div 
            className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-[#141C33] p-6">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedLead.name}</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Score: <span className={`font-semibold ${
                    selectedLead.score >= 80 ? 'text-green-500' : 
                    selectedLead.score >= 50 ? 'text-yellow-500' : 'text-red-500'
                  }`}>{selectedLead.score?.toFixed(1)}%</span>
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Requirements Checklist - Collapsible */}
              <div>
                <button
                  onClick={() => toggleSection('requirements')}
                  className="w-full flex items-center justify-between text-lg font-semibold text-white mb-4 px-4 py-3 rounded-lg hover:bg-gray-700/30 transition-all"
                >
                  <span>Requirements Checklist</span>
                  {expandedSections.requirements ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
                
                {expandedSections.requirements && (
                  <>
                    {selectedLead.scoring_data?.results && selectedLead.scoring_data.results.length > 0 ? (
                      <div className="space-y-2">
                        {selectedLead.scoring_data.results.map((result: any) => (
                          <div 
                            key={result.id}
                            className={`flex items-start gap-3 rounded-lg border p-4 ${
                              result.matched 
                                ? 'border-green-500/20 bg-green-500/5' 
                                : 'border-red-500/20 bg-red-500/5'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {result.matched ? (
                                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-white font-medium">{result.label}</p>
                              {!result.matched && result.candidate_value && result.candidate_value !== 'N/A' && (
                                <p className="text-sm text-gray-400 mt-1">
                                  Candidate: <span className="text-gray-300">{result.candidate_value}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-6">
                        <div className="flex items-start gap-3">
                          <svg className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <h4 className="text-lg font-semibold text-yellow-500 mb-2">No Requirements Data</h4>
                            <p className="text-gray-400 text-sm">
                              This lead has been scored but no requirements checklist is available.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Scoring Result (JSON) - Collapsible */}
              <div>
                <button
                  onClick={() => toggleSection('scoringResult')}
                  className="w-full flex items-center justify-between text-lg font-semibold text-white mb-4 px-4 py-3 rounded-lg hover:bg-gray-700/30 transition-all"
                >
                  <span>Scoring Result (JSON)</span>
                  {expandedSections.scoringResult ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
                
                {expandedSections.scoringResult && (
                  <>
                    {selectedLead.scoring_data ? (
                      <div className="rounded-lg border border-gray-700 bg-[#141C33]">
                        <pre className="p-4 text-xs text-gray-300 overflow-auto max-h-96">
                          {JSON.stringify(selectedLead.scoring_data, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-700 bg-[#141C33] p-6">
                        <p className="text-gray-400 text-center">No scoring data available</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Profile Data (JSON) - Collapsible - NEW */}
              <div>
                <button
                  onClick={() => toggleSection('profileData')}
                  className="w-full flex items-center justify-between text-lg font-semibold text-white mb-4 px-4 py-3 rounded-lg hover:bg-gray-700/30 transition-all"
                >
                  <span>Profile Data (JSON)</span>
                  {expandedSections.profileData ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
                
                {expandedSections.profileData && (
                  <>
                    {selectedLead.profile_data ? (
                      <div className="rounded-lg border border-gray-700 bg-[#141C33]">
                        <pre className="p-4 text-xs text-gray-300 overflow-auto max-h-96">
                          {JSON.stringify(selectedLead.profile_data, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-700 bg-[#141C33] p-6">
                        <p className="text-gray-400 text-center">No profile data available</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Outreach Message - Collapsible */}
              <div>
                <button
                  onClick={() => toggleSection('outreachMessage')}
                  className="w-full flex items-center justify-between text-lg font-semibold text-white mb-4 px-4 py-3 rounded-lg hover:bg-gray-700/30 transition-all"
                >
                  <span>Outreach Message</span>
                  {expandedSections.outreachMessage ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
                
                {expandedSections.outreachMessage && (
                  <>
                    {selectedLead.note_sent ? (
                      <div className="rounded-lg border border-gray-700 bg-[#141C33] p-4">
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{selectedLead.note_sent}</p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-700 bg-[#141C33] p-6">
                        <p className="text-gray-400 text-center text-sm">No outreach message sent yet</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {selectedLead.profile_url && (
                  <a
                    href={selectedLead.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                  >
                    View LinkedIn Profile
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
