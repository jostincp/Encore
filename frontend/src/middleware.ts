import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { searchParams, pathname } = request.nextUrl;
  
  // Detectar parámetros QR
  const barId = searchParams.get('b');
  const tableNumber = searchParams.get('t');
  
  if (barId && tableNumber) {
    // Guardar en cookies para persistencia
    const response = NextResponse.next();
    
    // Establecer cookies con los parámetros QR
    response.cookies.set('encore_bar_id', barId, {
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    response.cookies.set('encore_table_number', tableNumber, {
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Si es la página principal, redirigir a la página de cliente
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/client/music', request.url));
    }
    
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};