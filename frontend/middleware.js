// frontend/middleware.js

export const config = {
  // Explicitly list all active routes in your SPA to avoid regex engine mismatches
  matcher: [
    '/', 
    '/login', 
    '/signup', 
    '/auth/callback', 
    '/update-password',
    '/dashboard', 
    '/ideas', 
    '/media', 
    '/chat/:path*', 
    '/drafts', 
    '/scheduled', 
    '/published', 
    '/calendar', 
    '/settings', 
    '/automations', 
    '/upgrade',
    '/referrals'
  ],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  
  // Extract session tracking cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const hasSession = cookieHeader.includes('postra_session_active=true');

  // ── 1. Root Route Routing ──
  if (url.pathname === '/') {
    if (hasSession) {
      // Authenticated users go straight to dashboard
      return Response.redirect(new URL('/dashboard', request.url), 307);
    } else {
      // Unauthenticated users see the landing page transparently via proxy fetch
      try {
        const landingResponse = await fetch('https://postra-landing.vercel.app');
        return new Response(landingResponse.body, {
          status: landingResponse.status,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, must-revalidate',
          },
        });
      } catch (err) {
        console.error('Edge proxy to landing page failed:', err);
        return Response.redirect(new URL('/login', request.url), 307);
      }
    }
  }

  // ── 2. Auth Page Routing ──
  if (url.pathname === '/login' || url.pathname === '/signup') {
    if (hasSession) {
      return Response.redirect(new URL('/dashboard', request.url), 307);
    }
  }

  // ── 3. React SPA Route Rewrite (Bypasses assets, rewrites pages to index.html) ──
  return new Response(null, {
    headers: {
      'x-middleware-rewrite': '/index.html'
    }
  });
}