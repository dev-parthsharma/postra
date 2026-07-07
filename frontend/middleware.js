// frontend/middleware.js

export const config = {
  matcher: ['/', '/login', '/signup'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  
  // Extract our dynamic session tracking cookie
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
        
        // Return landing page content with its native headers
        return new Response(landingResponse.body, {
          status: landingResponse.status,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, must-revalidate',
          },
        });
      } catch (err) {
        console.error('Edge rewrite proxy to landing page failed:', err);
        // Fallback to Vite login if proxy fails
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

  // Continue standard execution for assets and Vite routing
  return new Response(null, {
    headers: { 'x-middleware-next': '1' }
  });
}