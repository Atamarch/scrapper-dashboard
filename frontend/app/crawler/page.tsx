'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';
import { Bot, Play, Square, RefreshCw, Users, CheckCircle2, AlertCircle, Clock, Zap } from 'lucide-react';
import { crawlerAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  company_name?: string;
}

interface LeadStats {
  total: number;
  complete: number;
  needProcessing: number;
  completionRate: number;
}

interface CrawlerStatus {
  isRunning: boolean;
  currentTemplate?: string;
  startedAt?: string;
  processedCount: number;
}

export default function CrawlerPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [leadStats, setLeadStats] = useState<LeadStats | null>(null);
  const [crawlerStatus, setCrawlerStatus] = useState<CrawlerStatus>({
    isRunning: false,
    processedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [starting, setStarting] = useState(false);

  // Fetch templates on component mount
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Analyze leads when template is selected
  useEffect(() => {
    if (selectedTemplate) {
      analyzeLeads(selectedTemplate);
    } else {
      setLeadStats(null);
    }
  }, [selectedTemplate]);

  // Poll crawler status every 3 seconds
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const status = await crawlerAPI.getCrawlerStatus();
        setCrawlerStatus(prev => {
          // If crawler stopped (queue empty), clear template info
          if (!status.is_running && prev.isRunning) {
            return {
              isRunning: false,
              currentTemplate: undefined,
              processedCount: 0,
              startedAt: undefined
            };
          }
          
          // Otherwise, keep template info and update queue size
          return {
            isRunning: status.is_running,
            currentTemplate: prev.currentTemplate,
            processedCount: status.queue_size,
            startedAt: prev.startedAt
          };
        });
      } catch (error) {
        console.error('Error polling status:', error);
      }
    };

    // Poll immediately
    pollStatus();

    // Then poll every 3 seconds
    const interval = setInterval(pollStatus, 3000);

    return () => clearInterval(interval);
  }, []); // Empty dependency - only run once on mount

  const fetchTemplates = async () => {
    try {
      const response = await crawlerAPI.getTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const analyzeLeads = async (templateId: string) => {
    setAnalyzing(true);
    try {
      const stats = await crawlerAPI.analyzeLead(templateId);
      setLeadStats(stats);
      toast.success('Analysis complete!');
    } catch (error) {
      console.error('Error analyzing leads:', error);
      toast.error('Failed to analyze leads');
    } finally {
      setAnalyzing(false);
    }
  };

  const startCrawler = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template first');
      return;
    }

    setStarting(true);
    try {
      const result = await crawlerAPI.startScraping({
        template_id: selectedTemplate
      });
      
      if (result.success) {
        const selectedTemplateName = templates.find(t => t.id === selectedTemplate)?.name;
        
        setCrawlerStatus({
          isRunning: true,
          currentTemplate: selectedTemplateName,
          startedAt: new Date().toISOString(),
          processedCount: result.leads_queued
        });

        toast.success(`${result.leads_queued} leads queued for scraping!`);
      } else {
        toast.error('Failed to start crawler');
      }
    } catch (error) {
      console.error('Error starting crawler:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to start crawler: ${errorMessage}`);
    } finally {
      setStarting(false);
    }
  };

  const stopCrawler = async () => {
    try {
      const result = await crawlerAPI.stopScraping();
      
      if (result.success) {
        setCrawlerStatus({
          isRunning: false,
          processedCount: 0,
          currentTemplate: undefined,
          startedAt: undefined
        });
        toast.success(result.message);
      } else {
        toast.error('Failed to stop crawler');
      }
    } catch (error) {
      console.error('Error stopping crawler:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to stop crawler: ${errorMessage}`);
    }
  };

  const getStatusColor = (status: 'idle' | 'running' | 'stopping') => {
    switch (status) {
      case 'running':
        return 'text-green-500';
      case 'stopping':
        return 'text-yellow-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusBg = (status: 'idle' | 'running' | 'stopping') => {
    switch (status) {
      case 'running':
        return 'bg-green-500/10 border-green-500/20';
      case 'stopping':
        return 'bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  const currentStatus = crawlerStatus.isRunning ? 'running' : 'idle';

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopHeader />

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-8 md:px-20 md:py-8 xl:px-40 xl:py-16">
            <div className="mb-10">
              <h1 className="text-4xl font-bold text-white">Crawler Management</h1>
              <p className="mt-2 text-base text-gray-400">Manage LinkedIn profile scraping by template</p>
            </div>

            {/* Crawler Status Card */}
            <div className="mb-8">
              <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Bot className="h-6 w-6 text-blue-500" />
                    <h2 className="text-xl font-semibold text-white">Crawler Status</h2>
                  </div>
                  <div className={`px-4 py-2 rounded-full border ${getStatusBg(currentStatus)}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${crawlerStatus.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                      <span className={`text-sm font-medium ${getStatusColor(currentStatus)}`}>
                        {crawlerStatus.isRunning ? 'Running' : 'Idle'}
                      </span>
                    </div>
                  </div>
                </div>

                {crawlerStatus.isRunning && (
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="bg-[#141C33] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-gray-400">Current Template</span>
                      </div>
                      <p className="text-white font-medium">{crawlerStatus.currentTemplate}</p>
                    </div>
                    <div className="bg-[#141C33] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-gray-400">Started At</span>
                      </div>
                      <p className="text-white font-medium">
                        {crawlerStatus.startedAt ? new Date(crawlerStatus.startedAt).toLocaleTimeString() : '-'}
                      </p>
                    </div>
                    <div className="bg-[#141C33] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-purple-500" />
                        <span className="text-sm text-gray-400">Queue Size</span>
                      </div>
                      <p className="text-white font-medium">{crawlerStatus.processedCount} leads</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  {!crawlerStatus.isRunning ? (
                    <button
                      onClick={startCrawler}
                      disabled={!selectedTemplate || starting}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      {starting ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      {starting ? 'Starting...' : 'Start Crawler'}
                    </button>
                  ) : (
                    <button
                      onClick={stopCrawler}
                      className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                    >
                      <Square className="h-4 w-4" />
                      Stop Crawler
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Template Selection */}
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Template Selection</h3>
                
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-12 bg-[#141C33] rounded-lg mb-4" />
                    <div className="h-4 bg-[#141C33] rounded w-3/4" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      disabled={crawlerStatus.isRunning}
                      className="w-full px-4 py-3 bg-[#141C33] border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a template...</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} {template.company_name && `(${template.company_name})`}
                        </option>
                      ))}
                    </select>
                    
                    {selectedTemplate && (
                      <div className="text-sm text-gray-400">
                        Selected template will be used to filter and process leads
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lead Analysis */}
              <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Lead Analysis</h3>
                
                {!selectedTemplate ? (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    Select a template to analyze leads
                  </div>
                ) : analyzing ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : leadStats ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 grid-cols-2">
                      <div className="bg-[#141C33] rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="text-sm text-gray-400">Total Leads</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{leadStats.total}</p>
                      </div>
                      <div className="bg-[#141C33] rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-gray-400">Complete</span>
                        </div>
                        <p className="text-2xl font-bold text-green-500">{leadStats.complete}</p>
                      </div>
                    </div>
                    
                    <div className="bg-[#141C33] rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm text-gray-400">Need Processing</span>
                      </div>
                      <p className="text-2xl font-bold text-yellow-500">{leadStats.needProcessing}</p>
                    </div>
                    
                    <div className="bg-[#141C33] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Completion Rate</span>
                        <span className="text-sm font-medium text-white">
                          {leadStats.completionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${leadStats.completionRate}%` }}
                        />
                      </div>
                    </div>
                    
                    {leadStats.needProcessing === 0 && (
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <span className="text-green-400 font-medium">
                            All leads are complete! No processing needed.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    Failed to analyze leads
                  </div>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="mt-8 rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
              <h3 className="text-lg font-semibold text-white mb-4">How it Works</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-500 font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Select Template</h4>
                    <p className="text-sm text-gray-400">Choose which job template to process</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-500 font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Analyze Leads</h4>
                    <p className="text-sm text-gray-400">System analyzes which leads need processing</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-500 font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Start Crawler</h4>
                    <p className="text-sm text-gray-400">Crawler processes incomplete leads only</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-500 font-bold text-sm">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium text-white">Auto Complete</h4>
                    <p className="text-sm text-gray-400">Profiles are scraped and scored automatically</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}