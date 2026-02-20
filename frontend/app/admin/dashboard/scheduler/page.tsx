'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Play, Pause, Trash2, Clock, Calendar, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { crawlerAPI, Schedule } from '@/lib/api';
import { ConfirmDialog } from '@/components/confirm-dialog';

type ScheduledJob = Schedule;

export default function CrawlerScheduler() {
  const router = useRouter();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledJob | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<ScheduledJob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startSchedule: '',
    startScheduleType: 'custom',
    stopSchedule: '',
    stopScheduleType: 'custom',
    enableStopTime: false,
    fileId: '',
    requirementId: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    startSchedule: '',
    startScheduleType: 'custom',
    stopSchedule: '',
    stopScheduleType: 'custom',
    enableStopTime: false,
    fileId: '',
    requirementId: '',
  });
  const [jsonFiles, setJsonFiles] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
    loadScheduledJobs();
    loadJsonFiles();
    loadRequirements();
  }, []);

  async function loadJsonFiles(excludeScheduleId?: string) {
    try {
      // Get all JSON files
      const { data: allFiles, error: filesError } = await supabase
        .from('crawler_jobs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filesError) {
        console.error('Error loading JSON files:', filesError);
        return;
      }

      // Get all file_ids that are already linked to schedules (except the one being edited)
      let query = supabase
        .from('crawler_schedules')
        .select('file_id')
        .not('file_id', 'is', null);
      
      if (excludeScheduleId) {
        query = query.neq('id', excludeScheduleId);
      }

      const { data: schedules, error: schedulesError } = await query;

      if (schedulesError) {
        console.error('Error loading schedules:', schedulesError);
        setJsonFiles(allFiles || []);
        return;
      }

      // Extract file_ids that are already used
      const usedFileIds = new Set(schedules?.map(s => s.file_id) || []);

      // Filter out files that are already linked to schedules
      const availableFiles = allFiles?.filter(file => !usedFileIds.has(file.id)) || [];
      
      setJsonFiles(availableFiles);
    } catch (error) {
      console.error('Failed to load JSON files:', error);
    }
  }

  async function loadRequirements() {
    try {
      const { data, error } = await supabase
        .from('requirements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setRequirements(data);
      }
    } catch (error) {
      console.error('Failed to load requirements:', error);
    }
  }

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.role !== 'admin') {
      router.replace('/admin');
    } else {
      setLoading(false);
    }
  }

  async function loadScheduledJobs() {
    try {
      // Fetch directly from Supabase to get file_name and file_id
      const { data, error } = await supabase
        .from('crawler_schedules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching schedules:', error);
        setJobs([]);
        setApiAvailable(false);
        return;
      }

      console.log('Schedules data:', data); // Debug log
      setJobs(data || []);
      setApiAvailable(true);
    } catch (error) {
      console.error('Failed to load schedules:', error);
      setJobs([]);
      setApiAvailable(false);
    }
  }

  async function handleToggleStatus(jobId: string) {
    try {
      await crawlerAPI.toggleSchedule(jobId);
      await loadScheduledJobs(); // Reload data
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      alert('Failed to toggle schedule status');
    }
  }

  async function handleRemove(jobId: string) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    setJobToDelete(job);
    setConfirmDialogOpen(true);
  }

  function handleEdit(job: ScheduledJob) {
    setEditingSchedule(job);
    setEditFormData({
      name: job.name,
      startSchedule: job.start_schedule,
      startScheduleType: 'custom',
      stopSchedule: job.stop_schedule || '',
      stopScheduleType: 'custom',
      enableStopTime: !!job.stop_schedule,
      fileId: job.file_id || '',
      requirementId: '',
    });
    loadJsonFiles(job.id); // Reload to get available files, excluding current schedule
    setShowEditModal(true);
  }

  async function handleUpdateSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!editingSchedule || !editFormData.name || !editFormData.startSchedule) {
      alert('Please fill in all required fields');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Get profile URLs from selected JSON file if changed
      let profileUrls = editingSchedule.profile_urls || [];
      let fileName = editingSchedule.file_name;
      
      if (editFormData.fileId && editFormData.fileId !== editingSchedule.file_id) {
        const selectedJson = jsonFiles.find(f => f.id === editFormData.fileId);
        if (selectedJson) {
          profileUrls = selectedJson.value?.map((item: any) => item.profile_url || item.url).filter(Boolean) || [];
          fileName = selectedJson.file_name;
        }
      }

      const { error } = await supabase
        .from('crawler_schedules')
        .update({
          name: editFormData.name,
          start_schedule: editFormData.startSchedule,
          stop_schedule: editFormData.enableStopTime && editFormData.stopSchedule ? editFormData.stopSchedule : null,
          file_id: editFormData.fileId || null,
          file_name: fileName || null,
          profile_urls: profileUrls,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSchedule.id);

      if (error) {
        console.error('Error updating schedule:', error);
        alert('Failed to update schedule');
        return;
      }

      await loadScheduledJobs();
      await loadJsonFiles(); // Reload to update available files
      setShowEditModal(false);
      setEditingSchedule(null);
      setEditFormData({
        name: '',
        startSchedule: '',
        startScheduleType: 'custom',
        stopSchedule: '',
        stopScheduleType: 'custom',
        enableStopTime: false,
        fileId: '',
        requirementId: '',
      });
    } catch (error) {
      console.error('Failed to update schedule:', error);
      alert('Failed to update schedule');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEditScheduleTypeChange(type: string, field: 'start' | 'stop') {
    const scheduleMap: { [key: string]: string } = {
      'hourly': '0 * * * *',
      'daily': '0 9 * * *',
      'daily-end': '0 18 * * *',
      'weekly': '0 9 * * 1',
      'monthly': '0 9 1 * *',
      'custom': '',
    };
    
    if (field === 'start') {
      setEditFormData({
        ...editFormData,
        startScheduleType: type,
        startSchedule: scheduleMap[type] || editFormData.startSchedule,
      });
    } else {
      setEditFormData({
        ...editFormData,
        stopScheduleType: type,
        stopSchedule: scheduleMap[type] || editFormData.stopSchedule,
      });
    }
  }

  async function confirmDelete() {
    if (!jobToDelete) return;
    
    try {
      await crawlerAPI.deleteSchedule(jobToDelete.id);
      await loadScheduledJobs(); // Reload data
      setJobToDelete(null);
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      alert('Failed to delete schedule');
    }
  }

  function handleScheduleTypeChange(type: string, field: 'start' | 'stop') {
    const scheduleMap: { [key: string]: string } = {
      'hourly': '0 * * * *',
      'daily': '0 9 * * *',
      'daily-end': '0 18 * * *',
      'weekly': '0 9 * * 1',
      'monthly': '0 9 1 * *',
      'custom': '',
    };
    
    if (field === 'start') {
      setFormData({
        ...formData,
        startScheduleType: type,
        startSchedule: scheduleMap[type] || '',
      });
    } else {
      setFormData({
        ...formData,
        stopScheduleType: type,
        stopSchedule: scheduleMap[type] || '',
      });
    }
  }

  async function handleAddSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (!formData.name || !formData.startSchedule) {
      alert('Please fill in all required fields');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Get profile URLs from selected JSON file
      const selectedJson = jsonFiles.find(f => f.id === formData.fileId);
      const profileUrls = selectedJson?.value?.map((item: any) => item.profile_url || item.url).filter(Boolean) || [];

      await crawlerAPI.createSchedule({
        name: formData.name,
        start_schedule: formData.startSchedule,
        stop_schedule: formData.enableStopTime && formData.stopSchedule ? formData.stopSchedule : undefined,
        profile_urls: profileUrls,
        max_workers: 3,
        file_id: formData.fileId || undefined,
        file_name: selectedJson?.file_name || undefined,
      });

      await loadScheduledJobs();
      await loadJsonFiles(); // Reload JSON files to update available list
      setShowAddModal(false);
      setFormData({ 
        name: '', 
        startSchedule: '', 
        startScheduleType: 'custom', 
        stopSchedule: '', 
        stopScheduleType: 'custom',
        enableStopTime: false,
        fileId: '',
        requirementId: '',
      });
    } catch (error) {
      console.error('Failed to create schedule:', error);
      alert('Failed to create schedule');
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Crawler Scheduler</h1>
            <button
              onClick={() => {
                setShowAddModal(true);
                loadJsonFiles(); // Reload JSON files when modal opens
              }}
              disabled={!apiAvailable}
              className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Schedule
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        {!apiAvailable && (
          <div className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/20 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-yellow-500">API Server Not Available</p>
                <p className="text-sm text-yellow-600">
                  Scheduler requires API server with database. Start the API server to use this feature.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid gap-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-800 bg-zinc-950 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Schedules</p>
                  <p className="mt-2 text-3xl font-bold">
                    {jobs.filter(j => j.status === 'active').length}
                  </p>
                </div>
                <div className="rounded-full bg-green-500/10 p-3">
                  <Clock className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-800 bg-zinc-950 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Paused Schedules</p>
                  <p className="mt-2 text-3xl font-bold">
                    {jobs.filter(j => j.status === 'paused').length}
                  </p>
                </div>
                <div className="rounded-full bg-yellow-500/10 p-3">
                  <Pause className="h-6 w-6 text-yellow-500" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-800 bg-zinc-950 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Schedules</p>
                  <p className="mt-2 text-3xl font-bold">{jobs.length}</p>
                </div>
                <div className="rounded-full bg-blue-500/10 p-3">
                  <Calendar className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Scheduled Jobs Table */}
          <div className="rounded-lg border border-gray-800 bg-zinc-950">
            <div className="p-6">
              <h2 className="text-lg font-semibold">Scheduled Jobs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-y border-gray-800 bg-zinc-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      JSON File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Start Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Stop Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Last Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Next Run
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {!apiAvailable ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="text-yellow-500">
                          <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="font-medium">API Server Not Running</p>
                          <p className="text-sm text-gray-400 mt-1">Start the API server to manage schedules</p>
                        </div>
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                        No scheduled jobs yet. Click "Add Schedule" to create one.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.id} className="transition-colors hover:bg-zinc-900">
                        <td className="px-6 py-4">
                          <div className="font-medium">{job.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          {job.file_name ? (
                            <div className="flex items-center gap-2">
                              <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-sm text-blue-400">{job.file_name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No file</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <code className="rounded bg-zinc-900 px-2 py-1 text-sm text-gray-300">
                            {job.start_schedule}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          {job.stop_schedule ? (
                            <code className="rounded bg-zinc-900 px-2 py-1 text-sm text-orange-400">
                              {job.stop_schedule}
                            </code>
                          ) : (
                            <span className="text-sm text-gray-500">No limit</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              job.status === 'active'
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-yellow-500/10 text-yellow-500'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                job.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                              }`}
                            />
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {formatDate(job.last_run)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {formatDate(job.next_run)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(job)}
                              className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-zinc-800"
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(job.id)}
                              className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-zinc-800"
                              title={job.status === 'active' ? 'Pause' : 'Resume'}
                            >
                              {job.status === 'active' ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleRemove(job.id)}
                              className="rounded-md border border-gray-700 p-2 transition-colors hover:border-red-800 hover:bg-red-950"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="w-full max-w-lg my-8 rounded-lg border border-gray-800 bg-zinc-950 shadow-xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Add New Schedule</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-md p-1 text-gray-400 transition-colors hover:bg-zinc-900 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent hover:scrollbar-thumb-gray-600">
              <form id="add-schedule-form" onSubmit={handleAddSchedule} className="space-y-5">
              {/* Schedule Name */}
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-300">
                  Schedule Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Daily Lead Crawler"
                  className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                  required
                />
              </div>

              {/* JSON File Selector */}
              <div>
                <label htmlFor="jsonFile" className="mb-2 block text-sm font-medium text-gray-300">
                  JSON File (Optional)
                </label>
                {jsonFiles.length === 0 ? (
                  <div className="rounded-md border border-gray-800 bg-zinc-900 px-4 py-8 text-center">
                    <p className="text-sm text-gray-400">No available JSON files</p>
                    <p className="mt-1 text-xs text-gray-500">All JSON files are already linked to schedules</p>
                  </div>
                ) : (
                  <>
                    <select
                      id="jsonFile"
                      value={formData.fileId}
                      onChange={(e) => setFormData({ ...formData, fileId: e.target.value })}
                      className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                    >
                      <option value="">No JSON file</option>
                      {jsonFiles.map((file) => (
                        <option key={file.id} value={file.id}>
                          {file.file_name} ({file.value?.length || 0} profiles)
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Select a JSON file to automatically populate profile URLs
                    </p>
                  </>
                )}
              </div>

              {/* Requirement Selector */}
              <div>
                <label htmlFor="requirement" className="mb-2 block text-sm font-medium text-gray-300">
                  Requirement (Optional)
                </label>
                <select
                  id="requirement"
                  value={formData.requirementId}
                  onChange={(e) => setFormData({ ...formData, requirementId: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                >
                  <option value="">No requirement</option>
                  {requirements.map((req) => (
                    <option key={req.id} value={req.id}>
                      {req.template_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Schedule Section */}
              <div className="space-y-3 rounded-lg border border-gray-800 bg-zinc-900/50 p-4">
                <h4 className="text-sm font-semibold text-white">Start Schedule</h4>
                
                <div>
                  <label htmlFor="startScheduleType" className="mb-2 block text-sm font-medium text-gray-300">
                    Schedule Type
                  </label>
                  <select
                    id="startScheduleType"
                    value={formData.startScheduleType}
                    onChange={(e) => handleScheduleTypeChange(e.target.value, 'start')}
                    className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                  >
                    <option value="hourly">Hourly (Every hour)</option>
                    <option value="daily">Daily (9:00 AM)</option>
                    <option value="weekly">Weekly (Monday 9:00 AM)</option>
                    <option value="monthly">Monthly (1st day, 9:00 AM)</option>
                    <option value="custom">Custom (Cron Expression)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="startSchedule" className="mb-2 block text-sm font-medium text-gray-300">
                    Cron Expression
                  </label>
                  <input
                    type="text"
                    id="startSchedule"
                    value={formData.startSchedule}
                    onChange={(e) => setFormData({ ...formData, startSchedule: e.target.value })}
                    placeholder="0 9 * * *"
                    className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 font-mono text-sm text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                    required
                    disabled={formData.startScheduleType !== 'custom'}
                  />
                </div>
              </div>

              {/* Stop Schedule Section */}
              <div className="space-y-3 rounded-lg border border-gray-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enableStopTime"
                    checked={formData.enableStopTime}
                    onChange={(e) => setFormData({ ...formData, enableStopTime: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-700 bg-zinc-900 text-white focus:ring-1 focus:ring-gray-600"
                  />
                  <label htmlFor="enableStopTime" className="text-sm font-semibold text-white">
                    Stop Schedule (Optional)
                  </label>
                </div>
                
                {formData.enableStopTime && (
                  <>
                    <div>
                      <label htmlFor="stopScheduleType" className="mb-2 block text-sm font-medium text-gray-300">
                        Schedule Type
                      </label>
                      <select
                        id="stopScheduleType"
                        value={formData.stopScheduleType}
                        onChange={(e) => handleScheduleTypeChange(e.target.value, 'stop')}
                        className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                      >
                        <option value="hourly">Hourly (Every hour)</option>
                        <option value="daily-end">Daily (6:00 PM)</option>
                        <option value="weekly">Weekly (Monday 9:00 AM)</option>
                        <option value="monthly">Monthly (1st day, 9:00 AM)</option>
                        <option value="custom">Custom (Cron Expression)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="stopSchedule" className="mb-2 block text-sm font-medium text-gray-300">
                        Cron Expression
                      </label>
                      <input
                        type="text"
                        id="stopSchedule"
                        value={formData.stopSchedule}
                        onChange={(e) => setFormData({ ...formData, stopSchedule: e.target.value })}
                        placeholder="0 18 * * *"
                        className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 font-mono text-sm text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                        disabled={formData.stopScheduleType !== 'custom'}
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        Crawler akan berhenti otomatis sesuai schedule ini
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Cron Helper */}
              <div className="rounded-md border border-gray-800 bg-zinc-900 p-4">
                <h4 className="mb-2 text-sm font-medium text-gray-300">Cron Expression Guide:</h4>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex justify-between">
                    <span>Every minute:</span>
                    <code className="text-gray-300">* * * * *</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Every hour:</span>
                    <code className="text-gray-300">0 * * * *</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Daily at 9 AM:</span>
                    <code className="text-gray-300">0 9 * * *</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Every Monday:</span>
                    <code className="text-gray-300">0 9 * * 1</code>
                  </div>
                  <div className="flex justify-between">
                    <span>1st of month:</span>
                    <code className="text-gray-300">0 9 1 * *</code>
                  </div>
                </div>
              </div>
            </form>
            </div>

            <div className="flex-shrink-0 border-t border-gray-800 p-6">
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-md border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-schedule-form"
                  disabled={isSubmitting}
                  className="flex-1 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : (
                    'Add Schedule'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Schedule Modal */}
      {showEditModal && editingSchedule && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div 
            className="w-full max-w-lg my-8 rounded-lg border border-gray-800 bg-zinc-950 shadow-xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold">Edit Schedule</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="rounded-md p-1 text-gray-400 transition-colors hover:bg-zinc-900 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="edit-schedule-form" onSubmit={handleUpdateSchedule} className="space-y-5">
                {/* Schedule Name */}
                <div>
                  <label htmlFor="edit-name" className="mb-2 block text-sm font-medium text-gray-300">
                    Schedule Name
                  </label>
                  <input
                    type="text"
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    placeholder="e.g., Daily Lead Crawler"
                    className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                    required
                  />
                </div>

                {/* JSON File Info (Read-only) */}
                {editingSchedule.file_name && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                      Current JSON File
                    </label>
                    <div className="flex items-center gap-2 rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5">
                      <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-blue-400">{editingSchedule.file_name}</span>
                    </div>
                  </div>
                )}

                {/* JSON File Selector */}
                <div>
                  <label htmlFor="edit-jsonFile" className="mb-2 block text-sm font-medium text-gray-300">
                    Change JSON File (Optional)
                  </label>
                  {jsonFiles.length === 0 && !editingSchedule.file_id ? (
                    <div className="rounded-md border border-gray-800 bg-zinc-900 px-4 py-8 text-center">
                      <p className="text-sm text-gray-400">No available JSON files</p>
                      <p className="mt-1 text-xs text-gray-500">All JSON files are already linked to schedules</p>
                    </div>
                  ) : (
                    <>
                      <select
                        id="edit-jsonFile"
                        value={editFormData.fileId}
                        onChange={(e) => setEditFormData({ ...editFormData, fileId: e.target.value })}
                        className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                      >
                        <option value="">No JSON file</option>
                        {/* Show current file even if it's already linked */}
                        {editingSchedule.file_id && editingSchedule.file_name && (
                          <option value={editingSchedule.file_id}>
                            {editingSchedule.file_name} (current)
                          </option>
                        )}
                        {/* Show available files */}
                        {jsonFiles.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.file_name} ({file.value?.length || 0} profiles)
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Select a different JSON file to update profile URLs
                      </p>
                    </>
                  )}
                </div>

                {/* Requirement Selector */}
                <div>
                  <label htmlFor="edit-requirement" className="mb-2 block text-sm font-medium text-gray-300">
                    Requirement (Optional)
                  </label>
                  <select
                    id="edit-requirement"
                    value={editFormData.requirementId}
                    onChange={(e) => setEditFormData({ ...editFormData, requirementId: e.target.value })}
                    className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                  >
                    <option value="">No requirement</option>
                    {requirements.map((req) => (
                      <option key={req.id} value={req.id}>
                        {req.template_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Schedule Section */}
                <div className="space-y-3 rounded-lg border border-gray-800 bg-zinc-900/50 p-4">
                  <h4 className="text-sm font-semibold text-white">Start Schedule</h4>
                  
                  <div>
                    <label htmlFor="edit-startScheduleType" className="mb-2 block text-sm font-medium text-gray-300">
                      Schedule Type
                    </label>
                    <select
                      id="edit-startScheduleType"
                      value={editFormData.startScheduleType}
                      onChange={(e) => handleEditScheduleTypeChange(e.target.value, 'start')}
                      className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                    >
                      <option value="hourly">Hourly (Every hour)</option>
                      <option value="daily">Daily (9:00 AM)</option>
                      <option value="weekly">Weekly (Monday 9:00 AM)</option>
                      <option value="monthly">Monthly (1st day, 9:00 AM)</option>
                      <option value="custom">Custom (Cron Expression)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit-startSchedule" className="mb-2 block text-sm font-medium text-gray-300">
                      Cron Expression
                    </label>
                    <input
                      type="text"
                      id="edit-startSchedule"
                      value={editFormData.startSchedule}
                      onChange={(e) => setEditFormData({ ...editFormData, startSchedule: e.target.value })}
                      placeholder="0 9 * * *"
                      className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 font-mono text-sm text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                      required
                      disabled={editFormData.startScheduleType !== 'custom'}
                    />
                  </div>
                </div>

                {/* Stop Schedule Section */}
                <div className="space-y-3 rounded-lg border border-gray-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-enableStopTime"
                      checked={editFormData.enableStopTime}
                      onChange={(e) => setEditFormData({ ...editFormData, enableStopTime: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-700 bg-zinc-900 text-white focus:ring-1 focus:ring-gray-600"
                    />
                    <label htmlFor="edit-enableStopTime" className="text-sm font-semibold text-white">
                      Stop Schedule (Optional)
                    </label>
                  </div>
                  
                  {editFormData.enableStopTime && (
                    <>
                      <div>
                        <label htmlFor="edit-stopScheduleType" className="mb-2 block text-sm font-medium text-gray-300">
                          Schedule Type
                        </label>
                        <select
                          id="edit-stopScheduleType"
                          value={editFormData.stopScheduleType}
                          onChange={(e) => handleEditScheduleTypeChange(e.target.value, 'stop')}
                          className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 text-white focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                        >
                          <option value="hourly">Hourly (Every hour)</option>
                          <option value="daily-end">Daily (6:00 PM)</option>
                          <option value="weekly">Weekly (Monday 9:00 AM)</option>
                          <option value="monthly">Monthly (1st day, 9:00 AM)</option>
                          <option value="custom">Custom (Cron Expression)</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="edit-stopSchedule" className="mb-2 block text-sm font-medium text-gray-300">
                          Cron Expression
                        </label>
                        <input
                          type="text"
                          id="edit-stopSchedule"
                          value={editFormData.stopSchedule}
                          onChange={(e) => setEditFormData({ ...editFormData, stopSchedule: e.target.value })}
                          placeholder="0 18 * * *"
                          className="w-full rounded-md border border-gray-700 bg-zinc-900 px-4 py-2.5 font-mono text-sm text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                          disabled={editFormData.stopScheduleType !== 'custom'}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Cron Helper */}
                <div className="rounded-md border border-gray-800 bg-zinc-900 p-4">
                  <h4 className="mb-2 text-sm font-medium text-gray-300">Cron Expression Guide:</h4>
                  <div className="space-y-1 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Every minute:</span>
                      <code className="text-gray-300">* * * * *</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Every hour:</span>
                      <code className="text-gray-300">0 * * * *</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily at 9 AM:</span>
                      <code className="text-gray-300">0 9 * * *</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Every Monday:</span>
                      <code className="text-gray-300">0 9 * * 1</code>
                    </div>
                    <div className="flex justify-between">
                      <span>1st of month:</span>
                      <code className="text-gray-300">0 9 1 * *</code>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="flex-shrink-0 border-t border-gray-800 p-6">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 rounded-md border border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-schedule-form"
                  disabled={isSubmitting}
                  className="flex-1 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Update Schedule'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setJobToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Scheduled Job"
        message={`Are you sure you want to delete "${jobToDelete?.name}"? This will stop all scheduled runs. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
