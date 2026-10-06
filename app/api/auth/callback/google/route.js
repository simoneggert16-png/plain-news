import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const origin = process.env.NODE_ENV === 'production' 
    ? 'https://www.plain-news.ch' 
    : 'http://localhost:3000';

  if (error || !code) {
    return NextResponse.redirect(`${origin}/de?auth_error=${encodeURIComponent(error || 'missing_code')}`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/callback/google`;

  try {
    // Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Failed to get Google access token', tokenData);
      return NextResponse.redirect(`${origin}/de?auth_error=token_failed`);
    }

    // Fetch user profile from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    const sessionPayload = {
      name: profile.name || 'Google Nutzer',
      email: profile.email || '',
      avatar: profile.picture || profile.name?.charAt(0) || 'G',
      provider: 'google',
      googleId: profile.id,
      loggedInAt: new Date().toISOString(),
    };

    const res = NextResponse.redirect(`${origin}/de?auth_success=1`);
    res.cookies.set('plain_session', JSON.stringify(sessionPayload), {
      path: '/',
      maxAge: 30 * 24 * 3600,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res;
  } catch (err) {
    console.error('Google OAuth callback error', err);
    return NextResponse.redirect(`${origin}/de?auth_error=exception`);
  }
}
