'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { supabase } from '@/lib/supabase';
import { User, Mail, Calendar, Shield, ArrowLeft } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        setUserName(user.user_metadata?.full_name || '');
        setUserRole(user.app_metadata?.role || '');
        setCreatedAt(user.created_at || '');
      }
      setLoading(false);
    }
    getUserData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen bg-[#0f1419]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="border-b border-gray-700 bg-[#1a1f2e] px-8 py-5 shadow-lg" 
               style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}>
            <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
            <p className="mt-1 text-sm text-gray-400">View your account information</p>
          </div>
          <div className="p-8">
            <div className="flex items-center justify-center h-64">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f1419]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed Header with shadow */}
        <div className="flex-shrink-0 border-b border-gray-700 bg-[#1a1f2e] px-8 py-5 shadow-lg" 
             style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
              <p className="mt-1 text-sm text-gray-400">View your account information</p>
            </div>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-[#141C33] px-4 py-2 text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8">
            <div className="max-w-2xl mx-auto">
              {/* Profile Card */}
              <div className="rounded-xl border border-gray-700 bg-[#1a1f2e] overflow-hidden">
                {/* Header with Avatar */}
                <div className="bg-gradient-to-r from-blue-600/20 to-blue-800/20 p-5 border-b border-gray-700">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-200 to-white text-white font-bold text-4xl shadow-lg">
                      <img src="/logo-sarana-without-text.png" className='w-8 h-8' alt="" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">{userName}</h2>
                      <p className="text-gray-400 text-sm mt-0.5">{userEmail}</p>
                    </div>
                  </div>
                </div>

                {/* Account Information */}
                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-white mb-3">Account Information</h3>
                    <div className="space-y-2.5">
                      {/* Full Name */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                          <User className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs text-gray-500">Full Name</label>
                          <p className="text-white font-medium text-sm truncate">{userName}</p>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                          <Mail className="h-4 w-4 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs text-gray-500">Email Address</label>
                          <p className="text-white font-medium text-sm truncate">{userEmail}</p>
                        </div>
                      </div>

                      {/* Role */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                          <Shield className="h-4 w-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs text-gray-500">Role</label>
                          <p className="text-white font-medium text-sm capitalize">{userRole}</p>
                        </div>
                      </div>

                      {/* Account Created */}
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-gray-700/50">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
                          <Calendar className="h-4 w-4 text-yellow-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="text-xs text-gray-500">Account Created</label>
                          <p className="text-white font-medium text-sm">
                            {createdAt ? new Date(createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            }) : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Note */}
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                    <div className="flex gap-2.5">
                      <div className="flex-shrink-0">
                        <svg className="h-4 w-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs text-blue-300 font-medium">Read-Only Information</p>
                        <p className="text-xs text-blue-400/70 mt-0.5">
                          This information is managed by your administrator and cannot be edited directly.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
