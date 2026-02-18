'use client'

import { useState } from 'react'
import { Loader2, Download, Save, Link as LinkIcon, FileText } from 'lucide-react'

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
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Requirements Generator</h1>
        <p className="text-gray-600 mt-2">
          Generate job requirements from URL or job description
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Input</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter job details to generate requirements
          </p>

          <div className="space-y-4">
            {/* Mode Selection */}
            <div className="flex gap-2">
              <button
                onClick={() => setMode('url')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                  mode === 'url'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                From URL
              </button>
              <button
                onClick={() => setMode('text')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                  mode === 'text'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                From Text
              </button>
            </div>

            {/* Position Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position Title *
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g., Desk Collection - BPR KS Bandung"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* URL Input */}
            {mode === 'url' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Posting URL *
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/job-posting"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Enter the URL of the job posting page
                </p>
              </div>
            )}

            {/* Text Input */}
            {mode === 'text' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Description *
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste job description here (can include HTML)"
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Paste the job description or kualifikasi section
                </p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Requirements'
              )}
            </button>

            {/* Alerts */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}
          </div>
        </div>

        {/* Output Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Generated Requirements</h2>
          <p className="text-sm text-gray-600 mb-4">
            Review and save the generated requirements
          </p>

          {!requirements ? (
            <div className="text-center py-12 text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No requirements generated yet</p>
              <p className="text-sm mt-2">Fill in the form and click Generate</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Parsed Data Summary */}
              {parsedData && (
                <div className="bg-blue-50 p-4 rounded-lg space-y-2 text-sm">
                  <h3 className="font-semibold text-blue-900">Extracted Information:</h3>
                  <div className="grid grid-cols-2 gap-2 text-blue-800">
                    <div>Gender: {parsedData.gender || 'Not specified'}</div>
                    <div>Location: {parsedData.location || 'Not specified'}</div>
                    <div>Min Experience: {parsedData.min_experience_years} years</div>
                    <div>Age Range: {parsedData.age_range ? `${parsedData.age_range.min}-${parsedData.age_range.max}` : 'Not specified'}</div>
                  </div>
                  {parsedData.experience_keywords?.length > 0 && (
                    <div>
                      <span className="font-medium">Keywords:</span> {parsedData.experience_keywords.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* JSON Preview */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="text-xs overflow-auto max-h-96 text-gray-800">
                  {JSON.stringify(requirements, null, 2)}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition"
                >
                  Save to Server
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition"
                >
                  Download JSON
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
