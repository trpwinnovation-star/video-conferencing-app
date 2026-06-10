'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { User } from '@/lib/api';

function TokenVerifier() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuth();

  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('tkn');

    if (!token) {
      router.push('/login');
      return;
    }

    async function apiLogin(email: string, password: string): Promise<User> {
      let apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      if (apiBase.endsWith('/')) apiBase = apiBase.slice(0, -1);
      const AUTH_URL = `${apiBase}/auth`;

      const res = await fetch(`${AUTH_URL}/authRegister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tkn: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      if (data.token && typeof window !== 'undefined') localStorage.setItem('auth_token', data.token);
      return data.user;
    }

    const verifyToken = async () => {
      try {
        await apiLogin('', '');
        // Refresh authentication state
        await refresh();
        // Redirect to home/dashboard
        router.push('/');
      } catch (err) {
        // Any error or non-200 response: redirect to login
        localStorage.removeItem('auth_token');
        router.push('/login');
      }
    };

    verifyToken();
  }, [searchParams, router, refresh]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-red-100">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
          <p className="text-gray-600 mb-6">{errorMessage || 'We were unable to verify your credentials.'}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <Loader className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-1">Verifying Credentials</h1>
        <p className="text-gray-500 text-sm">Please wait while we secure your session...</p>
      </div>
    </div>
  );
}

export default function TokenAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <Loader className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-1">Loading</h1>
        </div>
      </div>
    }>
      <TokenVerifier />
    </Suspense>
  );
}
