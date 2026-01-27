import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { Bindings } from './types';

export async function authMiddleware(c: Context<{ Bindings: Bindings }>, next: Next) {
  const sessionToken = getCookie(c, 'session_token');
  
  if (!sessionToken) {
    c.set('user', null);
    return await next();
  }
  
  try {
    // Decode session token (format: email:timestamp)
    const decoded = atob(sessionToken);
    const [email] = decoded.split(':');
    
    if (email) {
      c.set('user', { email });
    } else {
      c.set('user', null);
    }
  } catch (error) {
    c.set('user', null);
  }
  
  return await next();
}

export function requireAuth(c: Context) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return null;
}

export function requireAdmin(c: Context) {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Check if user is admin
  const email = user.email?.toLowerCase();
  if (email !== 'admin@ocevave') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
  
  return null;
}
