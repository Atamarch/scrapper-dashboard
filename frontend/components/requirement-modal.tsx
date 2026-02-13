'use client';

import { useState, useEffect } from 'react';
import { X, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Requirement } from '@/lib/supabase';

type RequirementModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onStart: (jobName: string, selectedRequirement: string) => void;
  jobName: string;
};

export function RequirementModal({ isOpen, onClose, onStart, jobName }: RequirementModalProps) {
  const [newJobName, setNewJobName] = useState('');
  const [selectedRequirement, setSelectedRequirement] = useState<string>('');
  const [previewRequirement, setPreviewRequirement] = useState<Requirement | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRequirements();
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

  if (!isOpen) return null;

  const handleStart = () => {
    if (!newJobName.trim() || !selectedRequirement) {
      alert('Please enter job name and select a requirement');
      return;
    }
    onStart(newJobName, selectedRequirement);
    setNewJobName('');
    setSelectedRequirement('');
    onClose();
  };

  const handleClose = () => {
    setNewJobName('');
    setSelectedRequirement('');
    setPreviewRequirement(null);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="w-full max-w-2xl rounded-lg border border-gray-800 bg-zinc-950 p-6">
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
              <div className="max-h-[350px] space-y-2 overflow-y-auto pr-2">
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
                      className="mt-1 h-4 w-4 border-gray-700 bg-zinc-800 text-white focus:ring-2 focus:ring-white focus:ring-offset-0"
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
                disabled={!newJobName.trim() || !selectedRequirement}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-gray-800 bg-zinc-950 p-6">
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
