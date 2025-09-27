import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return NextResponse.json({
    environment: {
      hasAnonKey: !!anonKey,
      hasServiceKey: !!serviceKey,
      hasUrl: !!url,
      anonKeyLength: anonKey?.length || 0,
      serviceKeyLength: serviceKey?.length || 0,
      url: url
    },
    keys: {
      anonKeyPrefix: anonKey?.substring(0, 20) + '...',
      serviceKeyPrefix: serviceKey?.substring(0, 20) + '...'
    }
  });
}
