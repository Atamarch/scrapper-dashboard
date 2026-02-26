'use client';

import { X, User, MapPin, Calendar, Briefcase, Zap, GraduationCap, FileText } from 'lucide-react';

type RequirementsViewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  templateName: string;
  requirements: any;
};

export function RequirementsViewModal({ isOpen, onClose, templateName, requirements }: RequirementsViewModalProps) {
  if (!isOpen) return null;

  // Parse requirements - handle both old and new format
  let requirementsList: any[] = [];
  let position = '';

  if (requirements) {
    // New format: { position: "...", requirements: [...] }
    if (requirements.requirements && Array.isArray(requirements.requirements)) {
      requirementsList = requirements.requirements;
      position = requirements.position || '';
    }
    // Old format: direct array
    else if (Array.isArray(requirements)) {
      requirementsList = requirements;
    }
  }

  // Group requirements by type for better organization
  const groupedRequirements = requirementsList.reduce((acc: any, req: any) => {
    const type = req.type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(req.value);
    return acc;
  }, {});

  const typeLabels: any = {
    gender: 'Gender',
    location: 'Location',
    age: 'Age Range',
    experience: 'Experience',
    skill: 'Skills',
    education: 'Education',
    other: 'Other'
  };

  const typeIcons: any = {
    gender: User,
    location: MapPin,
    age: Calendar,
    experience: Briefcase,
    skill: Zap,
    education: GraduationCap,
    other: FileText
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div 
        className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-lg border border-gray-700 bg-[#1a1f2e] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-[#141C33] p-6">
          <div>
            <h3 className="text-xl font-semibold text-white">Requirements</h3>
            <p className="text-sm text-gray-400 mt-1">{position || templateName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Requirements Checklist UI */}
          {requirementsList.length > 0 ? (
            <div>
              <h4 className="text-lg font-semibold text-white mb-4">Requirements Checklist</h4>
              
              {/* Group by type */}
              {Object.entries(groupedRequirements).map(([type, values]: [string, any]) => {
                const IconComponent = typeIcons[type] || FileText;
                return (
                  <div key={type} className="rounded-lg border border-gray-700 bg-[#141C33] mb-4 overflow-hidden">
                    {/* Type Header */}
                    <div className="flex items-center gap-3 bg-gradient-to-r from-blue-500/10 to-transparent px-4 py-3 border-b border-gray-700">
                      <IconComponent className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      <h5 className="text-sm font-semibold text-white">
                        {typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1)}
                      </h5>
                      <span className="ml-auto text-xs text-gray-500">
                        {values.length} {values.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    
                    {/* Values List */}
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {values.map((value: any, index: number) => (
                          <div 
                            key={index}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#1a1f2e] border border-gray-700 text-sm text-gray-300 hover:border-blue-500/50 transition-colors"
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                            <span className="capitalize">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-6">
              <div className="flex items-start gap-3">
                <svg className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="text-lg font-semibold text-yellow-500 mb-2">No Requirements Data</h4>
                  <p className="text-gray-400 text-sm">
                    This template has no requirements configured.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* JSON Raw Data */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Requirements (JSON)</h4>
            <div className="rounded-lg border border-gray-700 bg-[#141C33]">
              <pre className="p-4 text-xs text-gray-300 overflow-auto max-h-96">
                {JSON.stringify(requirements, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
