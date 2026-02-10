'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { TemplatesModal } from '@/components/templates-modal';
import { supabase, type Company } from '@/lib/supabase';
import { Building2, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ITEMS_PER_PAGE = 9;

export default function CompanyPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    async function fetchCompanies() {
      setLoading(true);
      console.log('Starting to fetch companies...');
      try {
        // Test koneksi dulu
        const testQuery = await supabase.from('companies').select('count');
        console.log('Test query result:', testQuery);

        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });

        console.log('Full response:', { data, error });

        if (error) {
          console.error('Supabase error:', error);
          alert(`Error: ${error.message}`);
        } else {
          console.log('Companies data:', data);
          console.log('Number of companies:', data?.length);
          setCompanies(data || []);
          setFilteredCompanies(data || []);
        }
      } catch (error) {
        console.error('Catch error:', error);
        alert(`Catch error: ${error}`);
      } finally {
        setLoading(false);
      }
    }

    fetchCompanies();
  }, []);

  useEffect(() => {
    const filtered = companies.filter(company =>
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredCompanies(filtered);
    setCurrentPage(1);
  }, [searchQuery, companies]);

  const totalPages = Math.ceil(filteredCompanies.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCompanies = filteredCompanies.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleViewRequirements = (company: Company) => {
    setSelectedCompany({ id: company.id, name: company.name });
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-[#141C33] to-transparent">            
            <h1 className="text-3xl font-bold text-white">Company</h1>
            <p className="mt-1 text-gray-400">
              Manage your companies ({filteredCompanies.length} total)
            </p>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search companies by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-[#1a1f2e] py-2.5 pl-10 pr-4 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl bg-[#1a1f2e]" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-flip-in">
                {paginatedCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="group relative rounded-xl border border-gray-700 bg-[#1a1f2e] p-6 transition-all hover:border-gray-600"
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                      <Building2 className="h-6 w-6 text-blue-500" />
                    </div>

                    <h3 className="mb-2 text-lg font-semibold text-white">{company.name}</h3>
                    <p className="mb-4 text-sm text-gray-500">Code: {company.code}</p>

                    <div className="flex items-center justify-between border-t border-gray-700 pt-4">
                      <span className="text-xs text-gray-500">
                        {new Date(company.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        onClick={() => handleViewRequirements(company)}
                        className="text-sm font-medium text-blue-500 transition-colors hover:text-blue-400"
                      >
                        View Requirements
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-gray-700 px-4 py-2 text-gray-400 transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
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

                  {totalPages > 5 && (
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
            </>
          )}
        </div>
      </main>

      {selectedCompany && (
        <TemplatesModal
          companyId={selectedCompany.id}
          companyName={selectedCompany.name}
          isOpen={!!selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
}
