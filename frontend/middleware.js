// frontend/middleware.js

export const config = {
  matcher: [
    '/', 
    '/login', 
    '/signup', 
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
      // Unauthenticated users see the landing page transparently
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
        console.error('Edge rewrite proxy to landing page failed:', err);
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

  // ── 3. React SPA Route Rewrite (Solves the 404 block for `/login`, `/signup`, etc.) ──
  try {
    const spaResponse = await fetch(new URL('/index.html', request.url));
    return new Response(spaResponse.body, spaResponse);
  } catch (err) {
    console.error('Failed to rewrite to index.html:', err);
  }
}