/**
 * Utility functions for URL handling across client and server
 */

/**
 * Get the base URL for the application
 * Uses environment variables in production, falls back to request origin
 */
export function getBaseUrl(req?: { nextUrl?: { origin: string } }): string {
  // Production: Use the first allowed origin (which should be the main domain)
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
    
  if (allowedOrigins.length > 0) {
    // Use the first allowed origin as the canonical URL
    return allowedOrigins[0];
  }
  
  // Development: Use NEXT_PUBLIC_APP_URL if set
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Fallback to request origin (for development)
  if (req?.nextUrl?.origin) {
    return req.nextUrl.origin;
  }
  
  // Final fallback for development
  return "http://localhost:3000";
}

/**
 * Get the base URL for client-side usage
 * Uses environment variables in production, falls back to window.location.origin
 */
export function getClientBaseUrl(): string {
  // Check if we have a public app URL set
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // In production, try to infer from the allowed origins
  if (typeof window !== 'undefined') {
    const host = window.location.host;
    
    // If we're on the production domain, use https
    if (host.includes('bug.coldran.com') || host.includes('coldran.com')) {
      return 'https://bug.coldran.com';
    }
    
    // For development, use current origin
    return window.location.origin;
  }
  
  // SSR fallback
  return "http://localhost:3000";
}

/**
 * Construct a full URL from a path
 */
export function createFullUrl(path: string, req?: { nextUrl?: { origin: string } }): string {
  const baseUrl = getBaseUrl(req);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Construct a full URL from a path (client-side)
 */
export function createClientFullUrl(path: string): string {
  const baseUrl = getClientBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
