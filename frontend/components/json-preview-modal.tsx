'use client';

import { X } from 'lucide-react';

type JsonPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  jobName: string;
  jsonData: any;
};

export function JsonPreviewModal({ isOpen, onClose, jobName, jsonData }: JsonPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-4xl rounded-lg border border-gray-800 bg-zinc-950 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">JSON Preview</h2>
            <p className="text-sm text-gray-400">{jobName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-gray-400 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[600px] overflow-y-auto rounded-md border border-gray-800 bg-zinc-900 p-4">
          <pre className="text-sm text-gray-300">
            <code>{JSON.stringify(jsonData, null, 2)}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
