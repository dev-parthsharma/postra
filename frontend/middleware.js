// frontend/middleware.js

export const config = {
  // STRICTLY match ONLY the root path. 
  // All other pages (/login, /signup, etc.) will bypass this entirely.
  matcher: ['/'],
};

export default async function middleware(request) {
  const url = new URL(request.url);
  
  // Extract session tracking cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const hasSession = cookieHeader.includes('postra_session_active=true');

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