'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import RobotCatMascot from '@/components/RobotCatMascot';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for mascot animation
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      if (!data.user) throw new Error('No user data returned');

      const role = data.user.user_metadata?.role || 
                   (data.user as any).app_metadata?.role || 
                   (data.user as any).raw_app_meta_data?.role;

      console.log('User role:', role);
      console.log('User metadata:', data.user.user_metadata);
      console.log('App metadata:', (data.user as any).app_metadata);

      if (role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error(`Access denied. Admin privileges required. Your role: ${role || 'none'}`);
      }

      sessionStorage.setItem('showWelcomeToast', 'true');
      
      // Wait for cookies to be set properly
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use hard redirect to ensure middleware picks up the new session
      window.location.href = '/';
      
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
      toast.error(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left Section - Image with Text Overlay (Hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 lg:w-1/2 relative overflow-hidden">
        {/* Background Image - Full Cover */}
        <div className="absolute inset-0">
          <img
            src="https://static.wixstatic.com/media/c21031_7b48b8fc0bcc4b129f35ab8c68b031de~mv2.jpg/v1/fill/w_640,h_630,fp_0.50_0.50,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/c21031_7b48b8fc0bcc4b129f35ab8c68b031de~mv2.jpg"
            alt="Office"
            className="w-full h-full object-cover"
          />
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/30 to-black/50" />
        </div>

        {/* Text Overlay */}
        <div className="relative z-10 flex flex-col justify-center items-start w-full p-8 lg:p-16">
          <h1 className="text-4xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 lg:mb-6 leading-tight">
            Welcome to <br className='lg:hidden' /> Sarana.AI
          </h1>
          <p className="text-base lg:text-xl text-gray-200 max-w-lg leading-relaxed">
            Transforming recruitment with the power of AI. Join us in redefining the future of hiring.
          </p>
        </div>
      </div>

      {/* Right Section - Login Form */}
      <div className="w-full md:w-1/2 lg:w-1/2 flex flex-col items-center justify-center p-6 md:p-8 lg:p-12 bg-[#0f1419]">
        {/* Logo - Sarana AI */}
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl shadow-lg shadow-blue-600/40 ring-1 ring-blue-500/20 bg-[#1a1f2e]">
            <Image 
              src="/logo-sarana-without-text.png" 
              alt="Sarana AI Logo" 
              width={44} 
              height={44} 
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">
            SARANA AI
          </h2>
          <p className="text-sm text-gray-400">Scrapper Dashboard</p>
        </div>

        {/* Robot Mascot */}
        <div className="flex justify-center">
          <RobotCatMascot 
            emailInputRef={emailInputRef}
            passwordInputRef={passwordInputRef}
            showPassword={showPassword}
            passwordValue={password}
          />
        </div>

        {/* Login Card */}
        <div className="w-full max-w-md animate-fade-in">
          <div className="rounded-xl bg-[#1a1f2e] p-8 shadow-lg shadow-blue-600/40">
            {/* Error Message */}
            {error && (
              <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 animate-shake">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 transition-colors group-focus-within:text-blue-500" />
                <input
                  ref={emailInputRef}
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full bg-[#0f1419] pl-10 pr-4 py-3 rounded-lg border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 transition-colors group-focus-within:text-blue-500" />
                <input
                  ref={passwordInputRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-10 pr-12 py-3 bg-[#0f1419] rounded-lg border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full py-3 rounded-lg bg-blue-500 text-white font-semibold hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 group overflow-hidden mt-6"
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              
              <span className="relative flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Login to Dashboard'
                )}
              </span>
            </button>
          </form>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                Having trouble logging in?{' '}
                <button type="button" className="text-blue-500 hover:text-blue-400 font-medium transition-colors">
                  Contact support
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
