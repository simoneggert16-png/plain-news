import { NextResponse } from 'next/server';

export async function GET(request) {
  const origin = process.env.NODE_ENV === 'production' 
    ? 'https://www.plain-news.ch' 
    : 'http://localhost:3000';

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = `${origin}/api/auth/callback/google`;

  const scope = encodeURIComponent('openid email profile');
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&prompt=select_account`;

  return NextResponse.redirect(googleAuthUrl);
}
