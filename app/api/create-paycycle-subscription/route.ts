import { NextResponse } from 'next/server';
// import { createClient } from '@supabase/supabase-js';
// import Stripe from 'stripe';

// Temporarily disabled - Stripe not configured yet
// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// );

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2024-06-20',
// });

export async function POST() {
  // Temporarily disabled - Stripe not configured yet
  return NextResponse.json({
    error: 'Stripe subscription functionality not yet implemented',
    message: 'This feature will be available once Stripe is configured'
  }, { status: 501 });
}
