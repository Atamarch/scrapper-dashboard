'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Loader2, Download, Save, Plus, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function RequirementsGeneratorPage() {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'url' | 'text'>('url')
  const [url, setUrl] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [position, setPosition] = useState('')
  const [requirements, setRequirements] = useState<any>(null)
  const [parsedData, setParsedData] = useState<any>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleGenerate = async () => {
    setError('')
    setSuccess('')
    
    if (!position) {
      setError('Position title is required')
      return
    }

    if (mode === 'url' && !url) {
      setError('URL is required')
      return
    }

    if (mode === 'text' && !jobDescription) {
      setError('Job description is required')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/requirements/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mode === 'url' ? url : undefined,
          job_description: mode === 'text' ? jobDescription : undefined,
          position
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate requirements')
      }

      const data = await response.json()
      setRequirements(data.requirements)
      setParsedData(data.parsed_data)
      setSuccess('Requirements generated successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to generate requirements')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!requirements) return

    const filename = position.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

    try {
      const response = await fetch(`${API_URL}/api/requirements/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirements,
          filename
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save requirements')
      }

      setSuccess('Requirements saved successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to save requirements')
    }
  }

  const handleDownload = () => {
    if (!requirements) return

    const filename = position.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '.json'
    const blob = new Blob([JSON.stringify(requirements, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8 p-1 rounded-xl bg-gradient-to-r from-[#1F2B4D] to-transparent">
            <div className="p-4 rounded-xl bg-gradient-to-r from-[#141C33] to-transparent flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">Requirements Generator</h1>
                <p className="mt-1 text-gray-400">Generate job requirements from URL or text</p>
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid gap-6">
            {/* Input Section */}
            <div className="rounded-lg border border-gray-700 bg-[#1a1f2e]">
              <div className="p-6">
                <h2 className="text-lg font-semibold mb-4 text-white">Input</h2>
                
                <div className="space-y-4">
                  {/* Mode Selection */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMode('url')}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                        mode === 'url'
                          ? 'bg-white text-black'
                          : 'bg-[#141C33] text-gray-400 hover:bg-gray-700 hover:text-white'
                      )}
                    >
                      From URL
                    </button>
                    <button
                      onClick={() => setMode('text')}
                      className={cn(
                        'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                        mode === 'text'
                          ? 'bg-white text-black'
                          : 'bg-[#141C33] text-gray-400 hover:bg-gray-700 hover:text-white'
                      )}
                    >
                      From Text
                    </button>
                  </div>

                  {/* Position Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Position Title
                    </label>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g., Desk Collection"
                      className="w-full rounded-md border border-gray-700 bg-[#141C33] px-4 py-2.5 text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                    />
                  </div>

                  {/* URL Input */}
                  {mode === 'url' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Job Posting URL
                      </label>
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/job-posting"
                        className="w-full rounded-md border border-gray-700 bg-[#141C33] px-4 py-2.5 text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                      />
                    </div>
                  )}

                  {/* Text Input */}
                  {mode === 'text' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Job Description
                      </label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste job description here..."
                        rows={8}
                        className="w-full rounded-md border border-gray-700 bg-[#141C33] px-4 py-2.5 text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 resize-none"
                      />
                    </div>
                  )}

                  {/* Alerts */}
                  {error && (
                    <div className="rounded-md border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="rounded-md border border-green-800 bg-green-950 px-4 py-3 text-sm text-green-400">
                      {success}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            {parsedData && (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                  <p className="text-sm text-gray-400">Gender</p>
                  <p className="mt-2 text-2xl font-bold text-white">{parsedData.gender || 'Any'}</p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                  <p className="text-sm text-gray-400">Location</p>
                  <p className="mt-2 text-2xl font-bold text-white">{parsedData.location || 'Any'}</p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                  <p className="text-sm text-gray-400">Min Experience</p>
                  <p className="mt-2 text-2xl font-bold text-white">{parsedData.min_experience_years} years</p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                  <p className="text-sm text-gray-400">Age Range</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {parsedData.age_range ? `${parsedData.age_range.min}-${parsedData.age_range.max}` : 'Any'}
                  </p>
                </div>
              </div>
            )}

            {/* Generated Requirements */}
            <div className="rounded-lg border border-gray-700 bg-[#1a1f2e]">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">Generated Requirements</h2>
                  {requirements && (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="rounded-md border border-gray-700 px-3 py-2 text-sm transition-colors hover:bg-gray-700 text-white"
                      >
                        <Save className="h-4 w-4 inline mr-1" />
                        Save
                      </button>
                      <button
                        onClick={handleDownload}
                        className="rounded-md border border-gray-700 px-3 py-2 text-sm transition-colors hover:bg-gray-700 text-white"
                      >
                        <Download className="h-4 w-4 inline mr-1" />
                        Download
                      </button>
                    </div>
                  )}
                </div>

                {!requirements ? (
                  <div className="py-12 text-center text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No requirements generated yet</p>
                    <p className="text-sm mt-2">Fill in the form and click Generate</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="rounded-md border border-gray-700 bg-[#141C33]">
                      <pre className="p-4 text-xs text-gray-300 overflow-auto max-h-96">
                        {JSON.stringify(requirements, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
