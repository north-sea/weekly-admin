import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/jwt-utils';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) {
    redirect('/login');
  }

  try {
    await verifyToken(token);
    redirect('/dashboard');
  } catch {
    redirect('/login');
  }
}
