import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          req.cookies.set({
            name,
            value,
            ...options,
          });
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          res.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          });
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          res.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // If accessing login page
  if (req.nextUrl.pathname === '/login') {
    // If already logged in, redirect to dashboard
    if (session?.user) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return res;
  }

  // For all other pages, check if user is logged in
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Check if user has admin role
  const userMetadata = session.user.user_metadata;
  const appMetadata = (session.user as any).app_metadata;
  const rawAppMetadata = (session.user as any).raw_app_meta_data;
  
  const role = userMetadata?.role || appMetadata?.role || rawAppMetadata?.role;

  console.log('Middleware - User role:', role);

  if (role !== 'admin') {
    // Not admin, redirect to login
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/company/:path*',
    '/crawler/:path*',
    '/leads/:path*',
    '/profile/:path*',
    '/requirements/:path*',
    '/scheduler/:path*',
  ],
};
