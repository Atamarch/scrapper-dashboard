'use client';

import { useState, useEffect } from 'react';
import { X, Eye, Clock, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Requirement } from '@/lib/supabase';

type Schedule = {
  id: string;
  name: string;
  start_schedule: string;
  status: string;
  created_at: string;
};

type RequirementModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onStart: (
    jobName: string,
    selectedRequirement: string,
    mode: 'existing' | 'new',
    scheduleData: {
      scheduleType?: 'now' | 'scheduled';
      cronSchedule?: string;
      existingScheduleId?: string;
    }
  ) => void;
  jobName: string;
  jsonFileId: string;
};

export function RequirementModal({ isOpen, onClose, onStart, jobName, jsonFileId }: RequirementModalProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [newJobName, setNewJobName] = useState('');
  const [selectedRequirement, setSelectedRequirement] = useState<string>('');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');
  const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now');
  const [cronSchedule, setCronSchedule] = useState('0 9 * * *');
  const [previewRequirement, setPreviewRequirement] = useState<Requirement | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRequirements();
      fetchSchedules();
    }
  }, [isOpen]);

  async function fetchRequirements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requirements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching requirements:', error);
        return;
      }

      setRequirements(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSchedules() {
    setLoadingSchedules(true);
    try {
      const { data, error } = await supabase
        .from('crawler_schedules')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching schedules:', error);
        return;
      }

      setSchedules(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingSchedules(false);
    }
  }

  if (!isOpen) return null;

  const handleStart = () => {
    if (mode === 'existing') {
      if (!selectedSchedule || !selectedRequirement) {
        alert('Please select a schedule and requirement');
        return;
      }
      onStart('', selectedRequirement, 'existing', { existingScheduleId: selectedSchedule });
    } else {
      if (!newJobName.trim() || !selectedRequirement) {
        alert('Please enter job name and select a requirement');
        return;
      }
      onStart(newJobName, selectedRequirement, 'new', {
        scheduleType,
        cronSchedule: scheduleType === 'scheduled' ? cronSchedule : undefined
      });
    }
    handleClose();
  };

  const handleClose = () => {
    setMode('new');
    setNewJobName('');
    setSelectedRequirement('');
    setSelectedSchedule('');
    setScheduleType('now');
    setCronSchedule('0 9 * * *');
    setPreviewRequirement(null);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
        <div className="w-full max-w-2xl my-8 rounded-lg border border-gray-800 bg-zinc-950 p-6 max-h-[90vh] overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Configure Crawler Job</h2>
              <p className="text-sm text-gray-400">Original: {jobName}</p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-zinc-900 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="mb-6 flex gap-2 rounded-lg border border-gray-800 bg-zinc-900 p-1">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'new'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Create New Schedule
            </button>
            <button
              onClick={() => setMode('existing')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'existing'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Use Existing Schedule
            </button>
          </div>

          {/* Existing Schedule Mode */}
          {mode === 'existing' && (
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Select Schedule
              </label>
              {loadingSchedules ? (
                <div className="py-8 text-center text-gray-400">Loading schedules...</div>
              ) : schedules.length === 0 ? (
                <div className="rounded-md border border-gray-800 bg-zinc-900 p-8 text-center text-gray-400">
                  No active schedules found. Create a new one instead.
                </div>
              ) : (
                <div className="max-h-[200px] space-y-2 overflow-y-auto pr-2">
                  {schedules.map((schedule) => (
                    <label
                      key={schedule.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${
                        selectedSchedule === schedule.id
                          ? 'border-white bg-zinc-800'
                          : 'border-gray-800 bg-zinc-900 hover:border-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="schedule"
                        checked={selectedSchedule === schedule.id}
                        onChange={() => setSelectedSchedule(schedule.id)}
                        className="mt-1 h-4 w-4 border-gray-700 bg-zinc-900 text-white focus:ring-0 focus:ring-offset-0 accent-white"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white">{schedule.name}</div>
                        <div className="text-xs text-gray-500">
                          Schedule: {schedule.start_schedule}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* New Schedule Mode */}
          {mode === 'new' && (
            <>
              {/* Job Name Input */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  New Job Name
                </label>
                <input
                  type="text"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  placeholder="Enter job name..."
                  className="w-full rounded-md border border-gray-700 bg-zinc-900 px-3 py-2 text-white placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                />
              </div>

              {/* Schedule Type Selection */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  When to Run
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleType('now')}
                    className={`flex items-center justify-center gap-2 rounded-md border p-4 transition-colors ${
                      scheduleType === 'now'
                        ? 'border-white bg-zinc-800 text-white'
                        : 'border-gray-800 bg-zinc-900 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <Zap className="h-5 w-5" />
                    <div>
                      <div className="font-medium">Run Now</div>
                      <div className="text-xs">Start immediately</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('scheduled')}
                    className={`flex items-center justify-center gap-2 rounded-md border p-4 transition-colors ${
                      scheduleType === 'scheduled'
                        ? 'border-white bg-zinc-800 text-white'
                        : 'border-gray-800 bg-zinc-900 text-gray-400 hover:border-gray-700'
                    }`}
                  >
                    <Clock className="h-5 w-5" />
                    <div>
                      <div className="font-medium">Schedule</div>
                      <div className="text-xs">Set specific time</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Cron Schedule Input */}
              {scheduleType === 'scheduled' && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Cron Schedule
                  </label>
                  <input
                    type="text"
                    value={cronSchedule}
                    onChange={(e) => setCronSchedule(e.target.value)}
                    placeholder="0 9 * * *"
                    className="w-full rounded-md border border-gray-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-white placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
                  />
                  <div className="mt-2 space-y-1 text-xs text-gray-500">
                    <div>Examples:</div>
                    <div>• <code className="rounded bg-zinc-800 px-1">0 9 * * *</code> - Every day at 9:00 AM</div>
                    <div>• <code className="rounded bg-zinc-800 px-1">0 */2 * * *</code> - Every 2 hours</div>
                    <div>• <code className="rounded bg-zinc-800 px-1">0 9 * * 1-5</code> - Weekdays at 9:00 AM</div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Requirements Selection */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Select Requirement (Choose one)
            </label>
            {loading ? (
              <div className="py-12 text-center text-gray-400">Loading requirements...</div>
            ) : requirements.length === 0 ? (
              <div className="py-12 text-center text-gray-400">No requirements found</div>
            ) : (
              <div className="max-h-[200px] space-y-2 overflow-y-auto pr-2">
                {requirements.map((req) => (
                  <label
                    key={req.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${
                      selectedRequirement === req.id
                        ? 'border-white bg-zinc-800'
                        : 'border-gray-800 bg-zinc-900 hover:border-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="requirement"
                      checked={selectedRequirement === req.id}
                      onChange={() => setSelectedRequirement(req.id)}
                      className="mt-1 h-4 w-4 border-gray-700 bg-zinc-900 text-white focus:ring-0 focus:ring-offset-0 accent-white"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-white">{req.template_name}</div>
                      <div className="text-xs text-gray-500">
                        Created: {new Date(req.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setPreviewRequirement(req);
                      }}
                      className="rounded-md border border-gray-700 p-2 text-gray-400 transition-colors hover:bg-zinc-800 hover:text-white"
                      title="View JSON"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-gray-800 pt-4">
            <span className="text-sm text-gray-400">
              {selectedRequirement ? '1 requirement selected' : 'No requirement selected'}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={
                  !selectedRequirement ||
                  (mode === 'existing' ? !selectedSchedule : !newJobName.trim())
                }
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Crawler
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewRequirement && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl my-8 rounded-lg border border-gray-800 bg-zinc-950 p-6 max-h-[90vh] flex flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Requirement JSON</h2>
                <p className="text-sm text-gray-400">{previewRequirement.template_name}</p>
              </div>
              <button
                onClick={() => setPreviewRequirement(null)}
                className="rounded-md p-2 text-gray-400 transition-colors hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[500px] overflow-y-auto rounded-md border border-gray-800 bg-zinc-900 p-4">
              <pre className="text-sm text-gray-300">
                <code>{JSON.stringify(previewRequirement.value, null, 2)}</code>
              </pre>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setPreviewRequirement(null)}
                className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-zinc-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
