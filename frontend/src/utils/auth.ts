/**
 * Authentication utilities
 */

interface DecodedToken {
  userId: string;
  email: string;
  role: string;
  companyId: string;
  iat: number;
  exp: number;
}

/**
 * Decode JWT token (without verification - server validates)
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

/**
 * Get current user from access token
 */
export function getCurrentUser(): DecodedToken | null {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  return decodeToken(token);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem('accessToken');
  if (!token) return false;
  
  const decoded = decodeToken(token);
  if (!decoded) return false;
  
  // Check if token is expired
  const now = Date.now() / 1000;
  return decoded.exp > now;
}
