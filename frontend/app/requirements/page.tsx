'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Loader2, Download, Save, Plus, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Template {
  id: string
  name: string
  requirements: any
}

export default function RequirementsGeneratorPage() {
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'url' | 'text'>('url')
  const [url, setUrl] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
  const [requirements, setRequirements] = useState<any>(null)
  const [parsedData, setParsedData] = useState<any>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch templates on mount
  useEffect(() => {
    async function fetchTemplates() {
      const { data, error } = await supabase
        .from('search_templates')
        .select('id, name, requirements')
        .order('name')
      
      if (error) {
        console.error('Error fetching templates:', error)
      } else {
        setTemplates(data || [])
      }
    }
    fetchTemplates()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showTemplateDropdown && !target.closest('.template-dropdown-container')) {
        setShowTemplateDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTemplateDropdown])

  const handleGenerate = async () => {
    setError('')
    setSuccess('')
    
    if (!selectedTemplate) {
      setError('Please select a template')
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
      const template = templates.find(t => t.id === selectedTemplate)
      const position = template?.name || 'Unknown Position'

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
      setParsedData(null) // No longer returned from API
      setSuccess('Requirements generated successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to generate requirements')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!requirements || !selectedTemplate) return

    try {
      // Update template in Supabase with new requirements
      const { error } = await supabase
        .from('search_templates')
        .update({ requirements })
        .eq('id', selectedTemplate)

      if (error) throw error

      setSuccess('Requirements saved to template successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to save requirements')
    }
  }

  const handleDownload = () => {
    if (!requirements) return

    const template = templates.find(t => t.id === selectedTemplate)
    const filename = (template?.name || 'requirements').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '.json'
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

                  {/* Template Selection Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Template
                    </label>
                    <div className="relative template-dropdown-container">
                      <button
                        onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                        className="w-full flex items-center justify-between rounded-md border border-gray-700 bg-[#141C33] px-4 py-2.5 text-white hover:border-gray-600 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                      >
                        <span className={selectedTemplate ? 'text-white' : 'text-gray-500'}>
                          {selectedTemplate 
                            ? templates.find(t => t.id === selectedTemplate)?.name 
                            : 'Choose a template...'}
                        </span>
                        {showTemplateDropdown ? (
                          <ChevronUp className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 flex-shrink-0" />
                        )}
                      </button>

                      {showTemplateDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-full max-h-[300px] overflow-y-auto rounded-lg border border-gray-700 bg-[#141C33] shadow-lg z-10">
                          {templates.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                              No templates found
                            </div>
                          ) : (
                            templates.map((template) => (
                              <button
                                key={template.id}
                                onClick={() => {
                                  setSelectedTemplate(template.id)
                                  setShowTemplateDropdown(false)
                                }}
                                className={cn(
                                  'w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-700/50',
                                  selectedTemplate === template.id 
                                    ? 'bg-gray-700/50 text-white' 
                                    : 'text-gray-400'
                                )}
                              >
                                {template.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
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
            {requirements && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                  <p className="text-sm text-gray-400">Position</p>
                  <p className="mt-2 text-xl font-bold text-white truncate">{requirements.position}</p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                  <p className="text-sm text-gray-400">Total Requirements</p>
                  <p className="mt-2 text-2xl font-bold text-white">{requirements.requirements?.length || 0}</p>
                </div>
                <div className="rounded-lg border border-gray-700 bg-[#1a1f2e] p-6">
                  <p className="text-sm text-gray-400">Requirement Types</p>
                  <p className="mt-2 text-xl font-bold text-white">
                    {requirements.requirements ? 
                      [...new Set(requirements.requirements.map((r: any) => r.type))].length 
                      : 0}
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
                  <div className="space-y-4">
                    {/* Requirements List View */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {requirements.requirements?.map((req: any, index: number) => (
                        <div 
                          key={req.id || index}
                          className="rounded-md border border-gray-700 bg-[#141C33] p-4 hover:border-gray-600 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                                  req.type === 'gender' && "bg-pink-900/30 text-pink-400",
                                  req.type === 'age' && "bg-blue-900/30 text-blue-400",
                                  req.type === 'education' && "bg-purple-900/30 text-purple-400",
                                  req.type === 'location' && "bg-green-900/30 text-green-400",
                                  req.type === 'experience' && "bg-orange-900/30 text-orange-400",
                                  req.type === 'skill' && "bg-gray-700/50 text-gray-400"
                                )}>
                                  {req.type}
                                </span>
                                <span className="text-xs text-gray-500">{req.id}</span>
                              </div>
                              <p className="text-sm text-white break-words">{req.label}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="text-xs text-gray-500 mb-1">Value:</p>
                              <p className="text-xs text-gray-300 font-mono break-all max-w-[200px]">
                                {typeof req.value === 'object' 
                                  ? JSON.stringify(req.value) 
                                  : req.value}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* JSON View (Collapsible) */}
                    <details className="group">
                      <summary className="cursor-pointer rounded-md border border-gray-700 bg-[#141C33] px-4 py-2 text-sm text-gray-400 hover:bg-gray-700/50 transition-colors">
                        <span className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          View JSON
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        </span>
                      </summary>
                      <div className="mt-2 rounded-md border border-gray-700 bg-[#141C33] overflow-hidden">
                        <pre className="p-4 text-xs text-gray-300 max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(requirements, null, 2)}
                        </pre>
                      </div>
                    </details>
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
