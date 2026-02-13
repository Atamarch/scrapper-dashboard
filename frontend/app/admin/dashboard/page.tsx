'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Upload, Play, Trash2, Eye } from 'lucide-react';
import { RequirementModal } from '@/components/requirement-modal';
import { JsonPreviewModal } from '@/components/json-preview-modal';
import { ConfirmDialog } from '@/components/confirm-dialog';

type CrawlerJob = {
  id: string;
  file_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  value?: any;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<CrawlerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [requirementModalOpen, setRequirementModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CrawlerJob | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<CrawlerJob | null>(null);
  const [stats] = useState({
    submitted: 45,
    processing: 12,
    finished: 28,
    scored: 25,
  });

  useEffect(() => {
    checkAuth();
    loadJobs();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.role !== 'admin') {
      router.replace('/admin');
    } else {
      setLoading(false);
    }
  }

  async function loadJobs() {
    try {
      const { data, error } = await supabase
        .from('crawler_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching jobs:', error);
        return;
      }

      setJobs(data || []);
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  }



  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Insert to Supabase
      const { data, error } = await supabase
        .from('crawler_jobs')
        .insert({
          file_name: file.name,
          value: json,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error inserting job:', error);
        alert('Failed to upload JSON file');
        return;
      }

      console.log('Job created:', data);
      await loadJobs();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload JSON file. Make sure it\'s a valid JSON.');
    } finally {
      setUploading(false);
    }
  }

  async function handleStart(jobId: string) {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setSelectedJob(job);
      setRequirementModalOpen(true);
    }
  }

  async function handleStartWithRequirements(jobName: string, requirement: string) {
    if (!selectedJob) return;
    
    try {
      // Update job with new name and status
      const { error } = await supabase
        .from('crawler_jobs')
        .update({
          file_name: jobName,
          status: 'processing'
        })
        .eq('id', selectedJob.id);

      if (error) {
        console.error('Error updating job:', error);
        alert('Failed to start job');
        return;
      }

      console.log('Job started:', selectedJob.id, 'with requirement:', requirement);
      
      // Reload jobs to get updated data
      await loadJobs();
    } catch (err) {
      console.error('Error starting job:', err);
      alert('Failed to start job');
    }
  }

  function handleViewJson(job: CrawlerJob) {
    setSelectedJob(job);
    setPreviewModalOpen(true);
  }

  async function handleRemove(jobId: string) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setJobToDelete(job);
    setConfirmDialogOpen(true);
  }

  async function confirmDelete() {
    if (!jobToDelete) return;

    try {
      const { error } = await supabase
        .from('crawler_jobs')
        .delete()
        .eq('id', jobToDelete.id);

      if (error) {
        console.error('Error deleting job:', error);
        alert('Failed to delete job');
        return;
      }

      setJobs(jobs.filter(j => j.id !== jobToDelete.id));
      setJobToDelete(null);
    } catch (err) {
      console.error('Error removing job:', err);
      alert('Failed to delete job');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 bg-zinc-950">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold">Crawler Dashboard</h1>
        </div>
      </header>

      <main className="px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <div className="rounded-lg border border-gray-800 bg-zinc-950 p-6">
              <h2 className="mb-4 text-lg font-semibold">Upload JSON Data</h2>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-zinc-900 p-12 transition-colors hover:border-gray-600">
                <Upload className="mb-4 h-12 w-12 text-gray-400" />
                <span className="mb-2 text-sm font-medium text-gray-300">
                  {uploading ? 'Uploading...' : 'Click to upload JSON file'}
                </span>
                <span className="text-xs text-gray-500">or drag and drop</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {/* Jobs List */}
            <div className="rounded-lg min-h-120 border border-gray-800 bg-zinc-950 p-6">
              <h2 className="mb-4 text-lg font-semibold">Crawler Jobs</h2>
              <div className="max-h-[380px] space-y-3 overflow-y-auto pr-2">
                {jobs.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    No jobs yet. Upload a JSON file to get started.
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-md border border-gray-800 bg-zinc-900 p-4"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{job.file_name}</div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-gray-400">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${job.status === 'completed'
                              ? 'bg-green-500'
                              : job.status === 'processing'
                                ? 'bg-yellow-500'
                                : 'bg-gray-500'
                              }`}
                          />
                          {job.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.status === 'pending' && (
                          <button
                            onClick={() => handleStart(job.id)}
                            className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-green-800"
                            title="Start"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleViewJson(job)}
                          className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-yellow-800"
                          title="View JSON"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(job.id)}
                          className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-red-950 hover:border-red-800"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="rounded-lg border border-gray-800 bg-zinc-950 p-6">
            <h2 className="mb-4 text-lg font-semibold">Statistics</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Submitted</span>
                  <span className="text-2xl font-bold">{stats.submitted}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-900">
                  <div className="h-2 rounded-full bg-white" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Processing</span>
                  <span className="text-2xl font-bold">{stats.processing}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-900">
                  <div className="h-2 rounded-full bg-yellow-500" style={{ width: '27%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Finished</span>
                  <span className="text-2xl font-bold">{stats.finished}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-900">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: '62%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Scored</span>
                  <span className="text-2xl font-bold">{stats.scored}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-900">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: '56%' }} />
                </div>
              </div>

              {/* Terminal Statistick */}
              <div className="rounded-lg border max-h-50 border-gray-800 bg-zinc-950 p-6">
                <h2 className="mb-4 text-lg font-semibold">Terminal Crawler</h2>
              </div>
              <div className="rounded-lg border max-h-50 border-gray-800 bg-zinc-950 p-6">
                <h2 className="mb-4 text-lg font-semibold">Terminal Scoring</h2>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <RequirementModal
        isOpen={requirementModalOpen}
        onClose={() => setRequirementModalOpen(false)}
        onStart={handleStartWithRequirements}
        jobName={selectedJob?.file_name || ''}
      />

      <JsonPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        jobName={selectedJob?.file_name || ''}
        jsonData={selectedJob?.value || {}}
      />

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setJobToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Crawler Job"
        message={`Are you sure you want to delete "${jobToDelete?.file_name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
