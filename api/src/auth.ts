import { supabase } from './supabase';

export type AuthedRequest = {
  user: { id: string };
};

export async function requireUser(req: any, res: any, next: any) {
  const header = String(req.headers.authorization ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: 'Missing token' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ message: 'Invalid token' });

  req.user = { id: data.user.id };
  next();
}