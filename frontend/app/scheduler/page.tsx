'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { TopHeader } from '@/components/top-header'
import { Plus, Play, Pause, Trash2, Clock, Calendar, X, Edit, PlayCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { crawlerAPI, Schedule } from '@/lib/api'
import toast from 'react-hot-toast'

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<Schedule[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingJob, setEditingJob] = useState<Schedule | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    start_schedule: '',
    template_id: '',
    status: 'active'
  })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadScheduledJobs()
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      const response = await crawlerAPI.getTemplates()
      setTemplates(response.templates || [])
    } catch (error) {
      console.error('Failed to load templates:', error)
      // Set empty array if failed to load
      setTemplates([])
    }
  }

  async function loadScheduledJobs() {
    try {
      const response = await crawlerAPI.getSchedules()
      setJobs(response.schedules || [])
    } catch (error) {
      console.error('Failed to load schedules:', error)
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    try {
      await crawlerAPI.createSchedule({
        name: formData.name,
        start_schedule: formData.start_schedule,
        template_id: formData.template_id,
        status: formData.status as 'active' | 'inactive'
      })

      // Reset form and close modal
      setFormData({
        name: '',
        start_schedule: '',
        template_id: '',
        status: 'active'
      })
      setShowModal(false)
      
      // Reload schedules
      await loadScheduledJobs()
      
      toast.success('Schedule created successfully!')
    } catch (error) {
      console.error('Failed to create schedule:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to create schedule: ${errorMessage}`)
    }
  }

  function handleEdit(job: Schedule) {
    setEditingJob(job)
    setFormData({
      name: job.name,
      start_schedule: job.start_schedule,
      template_id: job.template_id,
      status: job.status
    })
    setShowEditModal(true)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    
    if (!editingJob) return

    try {
      await crawlerAPI.updateSchedule(editingJob.id, {
        name: formData.name,
        start_schedule: formData.start_schedule,
        template_id: formData.template_id,
        status: formData.status as 'active' | 'inactive'
      })

      // Reset and close
      setEditingJob(null)
      setFormData({
        name: '',
        start_schedule: '',
        template_id: '',
        status: 'active'
      })
      setShowEditModal(false)
      
      // Reload schedules
      await loadScheduledJobs()
      
      toast.success('Schedule updated successfully!')
    } catch (error) {
      console.error('Failed to update schedule:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to update schedule: ${errorMessage}`)
    }
  }

  async function handleToggleStatus(jobId: string) {
    try {
      await crawlerAPI.toggleSchedule(jobId)
      await loadScheduledJobs()
      toast.success('Schedule status updated')
    } catch (error) {
      console.error('Failed to toggle schedule:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to toggle schedule: ${errorMessage}`)
    }
  }

  async function handleExecuteNow(jobId: string) {
    try {
      await crawlerAPI.executeScheduleManually(jobId)
      await loadScheduledJobs()
      toast.success('Schedule executed successfully')
    } catch (error) {
      console.error('Failed to execute schedule:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to execute schedule: ${errorMessage}`)
    }
  }

  async function handleRemove(jobId: string) {
    try {
      await crawlerAPI.deleteSchedule(jobId)
      await loadScheduledJobs()
      setDeleteConfirm(null)
      toast.success('Schedule deleted successfully')
    } catch (error) {
      console.error('Failed to delete schedule:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to delete schedule: ${errorMessage}`)
    }
  }

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopHeader />
        
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-8 md:px-20 md:py-8 xl:px-40 xl:py-16">
            <div className="mb-10">
              <h1 className="text-4xl font-bold text-white">Crawler Scheduler</h1>
              <p className="mt-2 text-base text-gray-400">Manage automated crawling schedules</p>
            </div>

          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Schedules</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {jobs.filter(j => j.status === 'active').length}
                  </p>
                </div>
                <div className="rounded-full bg-green-500/10 p-3">
                  <Clock className="h-6 w-6 text-green-500" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Inactive Schedules</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {jobs.filter(j => j.status === 'inactive').length}
                  </p>
                </div>
                <div className="rounded-full bg-yellow-500/10 p-3">
                  <Pause className="h-6 w-6 text-yellow-500" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Schedules</p>
                  <p className="mt-2 text-3xl font-bold text-white">{jobs.length}</p>
                </div>
                <div className="rounded-full bg-blue-500/10 p-3">
                  <Calendar className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Scheduled Jobs Table */}
          <div className="rounded-lg border border-gray-700 bg-[#1a1f2e]">
            <div className="p-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Scheduled Jobs</h2>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" />
                Add Schedule
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-y border-gray-700 bg-[#141C33]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Template
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Cron Schedule
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Last Run
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        No scheduled jobs yet. Click "Add Schedule" to create one.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => {
                      const template = templates.find(t => t.id === job.template_id)
                      return (
                        <tr key={job.id} className="transition-colors hover:bg-gray-700/30">
                          <td className="px-6 py-4">
                            <div className="font-medium text-white">{job.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-300">
                              {template ? template.position : job.template_id}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="rounded bg-[#141C33] px-2 py-1 text-sm text-gray-300">
                              {job.start_schedule}
                            </code>
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
                              {job.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-400">
                            {formatDate(job.last_run)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleExecuteNow(job.id)}
                                className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-green-700 text-white"
                                title="Execute Now"
                              >
                                <PlayCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(job)}
                                className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-gray-700 text-white"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(job.id)}
                                className="rounded-md border border-gray-700 p-2 transition-colors hover:bg-gray-700 text-white"
                                title={job.status === 'active' ? 'Pause' : 'Resume'}
                              >
                                {job.status === 'active' ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(job.id)}
                                className="rounded-md border border-gray-700 p-2 transition-colors hover:border-red-800 hover:bg-red-950 text-white"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      </main>

      {/* Add Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-white">Add New Schedule</h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 transition-colors hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Schedule Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-[#141C33] px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., Daily Morning Scraping"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Template
                </label>
                <select
                  required
                  value={formData.template_id}
                  onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-[#141C33] px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.position}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cron Schedule
                </label>
                <input
                  type="text"
                  required
                  value={formData.start_schedule}
                  onChange={(e) => setFormData({ ...formData, start_schedule: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-[#141C33] px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="0 9 * * *"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Examples: <code className="text-gray-400">0 9 * * *</code> (daily at 9 AM), 
                  <code className="text-gray-400 ml-2">0 */6 * * *</code> (every 6 hours)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-[#141C33] px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
                >
                  Create Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Schedule Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-white">Edit Schedule</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingJob(null)
                }}
                className="rounded-md p-1 transition-colors hover:bg-gray-700 text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Schedule Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-[#141C33] px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., Daily Morning Scraping"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Template
                </label>
                <select
                  required
                  value={formData.template_id}
                  onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-[#141C33] px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.position}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cron Schedule
                </label>
                <input
                  type="text"
                  required
                  value={formData.start_schedule}
                  onChange={(e) => setFormData({ ...formData, start_schedule: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-[#141C33] px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="0 9 * * *"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Examples: <code className="text-gray-400">0 9 * * *</code> (daily at 9 AM), 
                  <code className="text-gray-400 ml-2">0 */6 * * *</code> (every 6 hours)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded-md border border-gray-700 bg-[#141C33] px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingJob(null)
                  }}
                  className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
                >
                  Update Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Delete Schedule</h2>
              <p className="text-gray-300 mb-6">
                Are you sure you want to delete this schedule? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRemove(deleteConfirm)}
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
  )
}