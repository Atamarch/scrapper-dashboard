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
  const [linkedSchedules, setLinkedSchedules] = useState<{ [key: string]: string[] }>({});
  const [stats] = useState({
    submitted: 45,
    processing: 12,
    finished: 28,
    scored: 25,
  });

  useEffect(() => {
    checkAuth();
    loadJobs();
    loadLinkedSchedules();
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

  async function loadLinkedSchedules() {
    try {
      const { data, error } = await supabase
        .from('crawler_schedules')
        .select('file_id, name')
        .not('file_id', 'is', null);

      if (error) {
        console.error('Error fetching linked schedules:', error);
        return;
      }

      // Group schedule names by file_id
      const linked: { [key: string]: string[] } = {};
      data?.forEach(schedule => {
        if (schedule.file_id) {
          if (!linked[schedule.file_id]) {
            linked[schedule.file_id] = [];
          }
          linked[schedule.file_id].push(schedule.name);
        }
      });

      setLinkedSchedules(linked);
    } catch (err) {
      console.error('Error loading linked schedules:', err);
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

  async function handleStartWithRequirements(
    jobName: string,
    requirement: string,
    mode: 'existing' | 'new',
    scheduleData: {
      scheduleType?: 'now' | 'scheduled';
      cronSchedule?: string;
      existingScheduleId?: string;
    }
  ) {
    if (!selectedJob) return;
    
    try {
      // Extract profile URLs from JSON data
      const profileUrls = selectedJob.value?.map((item: any) => item.profile_url || item.url).filter(Boolean) || [];
      
      if (profileUrls.length === 0) {
        alert('No profile URLs found in JSON');
        return;
      }

      if (mode === 'existing') {
        // Validate existing schedule ID
        if (!scheduleData.existingScheduleId) {
          alert('Please select a schedule');
          return;
        }

        const updateData = {
          file_id: selectedJob.id,
          file_name: selectedJob.file_name,
          profile_urls: profileUrls
        };

        console.log('Updating schedule with data:', updateData); // Debug log
        console.log('Schedule ID:', scheduleData.existingScheduleId); // Debug log

        // Link JSON file to existing schedule
        const { data: updatedData, error } = await supabase
          .from('crawler_schedules')
          .update(updateData)
          .eq('id', scheduleData.existingScheduleId)
          .select();

        console.log('Update result:', { updatedData, error }); // Debug log

        if (error) {
          console.error('Error linking to schedule:', error);
          alert(`Failed to link to schedule: ${error.message}`);
          return;
        }

        // Update job status
        await supabase
          .from('crawler_jobs')
          .update({ status: 'processing' })
          .eq('id', selectedJob.id);

        alert(`JSON file linked to existing schedule!`);
      } else {
        // Create new schedule
        const finalCronSchedule = scheduleData.scheduleType === 'now' 
          ? '* * * * *'
          : scheduleData.cronSchedule || '0 9 * * *';

        const insertData = {
          name: jobName,
          status: 'active',
          start_schedule: finalCronSchedule,
          profile_urls: profileUrls,
          file_id: selectedJob.id,
          file_name: selectedJob.file_name,
          created_at: new Date().toISOString()
        };

        console.log('Inserting schedule with data:', insertData); // Debug log

        const { data: insertedData, error: scheduleError } = await supabase
          .from('crawler_schedules')
          .insert(insertData)
          .select();

        console.log('Insert result:', { insertedData, scheduleError }); // Debug log

        if (scheduleError) {
          console.error('Error creating schedule:', scheduleError);
          alert('Failed to create schedule');
          return;
        }

        // Update job status
        await supabase
          .from('crawler_jobs')
          .update({
            file_name: jobName,
            status: 'processing'
          })
          .eq('id', selectedJob.id);

        const message = scheduleData.scheduleType === 'now'
          ? `Schedule created! Crawler will process ${profileUrls.length} profiles immediately.`
          : `Schedule created! Crawler will process ${profileUrls.length} profiles at: ${finalCronSchedule}`;
        
        alert(message);
      }
      
      await loadJobs();
      await loadLinkedSchedules(); // Reload linked schedules
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
      // Check if this file is linked to any schedule
      const { data: linkedSchedules, error: checkError } = await supabase
        .from('crawler_schedules')
        .select('id, name')
        .eq('file_id', jobToDelete.id);

      if (checkError) {
        console.error('Error checking linked schedules:', checkError);
        alert('Failed to check if file is linked to schedules');
        return;
      }

      if (linkedSchedules && linkedSchedules.length > 0) {
        const scheduleNames = linkedSchedules.map(s => s.name).join(', ');
        alert(`Cannot delete this file. It is linked to the following schedule(s): ${scheduleNames}\n\nPlease delete or unlink the schedule(s) first.`);
        setJobToDelete(null);
        setConfirmDialogOpen(false);
        return;
      }

      // If not linked, proceed with deletion
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
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{job.file_name}</div>
                          {linkedSchedules[job.id] && linkedSchedules[job.id].length > 0 && (
                            <div 
                              className="group relative inline-flex"
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const tooltip = e.currentTarget.querySelector('.tooltip-content') as HTMLElement;
                                if (tooltip) {
                                  tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                  tooltip.style.top = `${rect.top - 8}px`;
                                  tooltip.style.transform = 'translate(-50%, -100%)';
                                }
                              }}
                            >
                              <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              <div className="tooltip-content pointer-events-none invisible fixed z-[9999] whitespace-nowrap rounded-md border border-gray-700 bg-zinc-900 px-3 py-2 text-xs text-white shadow-2xl opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
                                <div className="font-medium mb-1">Linked to schedule:</div>
                                <div className="text-gray-300">{linkedSchedules[job.id].join(', ')}</div>
                              </div>
                            </div>
                          )}
                        </div>
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
                          disabled={linkedSchedules[job.id] && linkedSchedules[job.id].length > 0}
                          className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-red-950 hover:border-red-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-900 disabled:hover:border-gray-700"
                          title={linkedSchedules[job.id] && linkedSchedules[job.id].length > 0 
                            ? `Cannot delete: Linked to ${linkedSchedules[job.id].join(', ')}`
                            : 'Remove'}
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
        jsonFileId={selectedJob?.id || ''}
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
