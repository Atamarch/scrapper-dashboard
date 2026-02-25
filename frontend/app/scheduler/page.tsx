'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Plus, Play, Pause, Trash2, Clock, Calendar, Edit } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { crawlerAPI, Schedule } from '@/lib/api'

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadScheduledJobs()
  }, [])

  async function loadScheduledJobs() {
    try {
      const { data, error } = await supabase
        .from('crawler_schedules')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setJobs(data)
      }
    } catch (error) {
      console.error('Failed to load schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleStatus(jobId: string) {
    try {
      await crawlerAPI.toggleSchedule(jobId)
      await loadScheduledJobs()
    } catch (error) {
      console.error('Failed to toggle schedule:', error)
      alert('Failed to toggle schedule status')
    }
  }

  async function handleRemove(jobId: string) {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    
    try {
      await crawlerAPI.deleteSchedule(jobId)
      await loadScheduledJobs()
    } catch (error) {
      console.error('Failed to delete schedule:', error)
      alert('Failed to delete schedule')
    }
  }

  function formatDate(dateString: string | null) {
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
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8 p-1 rounded-xl bg-gradient-to-r from-[#1F2B4D] to-transparent">
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#141C33] to-transparent flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Crawler Scheduler</h1>
                <p className="mt-1 text-gray-400">Manage automated crawling schedules</p>
              </div>
              <button
                className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
              >
                <Plus className="h-4 w-4" />
                Add Schedule
              </button>
            </div>
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
                  <p className="text-sm text-gray-400">Paused Schedules</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {jobs.filter(j => j.status === 'paused').length}
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
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white">Scheduled Jobs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-y border-gray-700 bg-[#141C33]">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                      Start Schedule
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
                    jobs.map((job) => (
                      <tr key={job.id} className="transition-colors hover:bg-gray-700/30">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white">{job.name}</div>
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
                              onClick={() => handleRemove(job.id)}
                              className="rounded-md border border-gray-700 p-2 transition-colors hover:border-red-800 hover:bg-red-950 text-white"
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
    </div>
  )
}
