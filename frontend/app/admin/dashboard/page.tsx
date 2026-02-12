'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Upload, Play, Trash2 } from 'lucide-react';

type CrawlerJob = {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed';
  created_at: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<CrawlerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
    // Mock data - replace with actual Supabase query
    setJobs([
      { id: '1', name: 'job_data_001.json', status: 'completed', created_at: new Date().toISOString() },
      { id: '2', name: 'job_data_002.json', status: 'processing', created_at: new Date().toISOString() },
      { id: '3', name: 'job_data_003.json', status: 'pending', created_at: new Date().toISOString() },
      { id: '4', name: 'job_data_003.json', status: 'pending', created_at: new Date().toISOString() },
      { id: '5', name: 'job_data_003.json', status: 'pending', created_at: new Date().toISOString() },
      { id: '6', name: 'job_data_003.json', status: 'pending', created_at: new Date().toISOString() },

    ]);
  }



  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // TODO: Save to Supabase
      console.log('Uploaded JSON:', json);

      await loadJobs();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload JSON file');
    } finally {
      setUploading(false);
    }
  }

  async function handleStart(jobId: string) {
    // TODO: Start crawler
    console.log('Starting job:', jobId);
  }

  async function handleRemove(jobId: string) {
    // TODO: Remove job
    console.log('Removing job:', jobId);
    setJobs(jobs.filter(j => j.id !== jobId));
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
                        <div className="font-medium">{job.name}</div>
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
                            className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-zinc-800"
                            title="Start"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
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
    </div>
  );
}
