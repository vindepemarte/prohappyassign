// The /// <reference ... /> directive was removed because the user's environment
// could not resolve it, causing a compilation error.
// The 'Deno' global, which is available in the Supabase Edge Function runtime,
// is declared as 'any' to satisfy the TypeScript compiler in an environment
// that is not configured for Deno. This is a workaround to prevent type errors
// during development.
declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import webpush from 'https://esm.sh/web-push@3.6.7';

// IMPORTANT: These VAPID keys must be set as environment variables
// in your Supabase project settings: Project > Settings > Edge Functions
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

// Centralized CORS headers for consistency
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error('VAPID keys are not set in environment variables.');
} else {
  webpush.setVapidDetails(
    'mailto:support@prohappyassignments.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

// req is typed as 'any' because with 'Deno' being 'any', type inference for the request object is lost.
Deno.serve(async (req: any) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { target, payload } = await req.json();

    if (!target || !payload || !payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    let userIds: string[] = [];

    if (target.userIds) {
        userIds = target.userIds;
    } else if (target.role) {
        if (target.role === 'all') {
            const { data, error } = await supabase.from('users').select('id');
            if (error) throw error;
            userIds = data.map((u: any) => u.id);
        } else {
            const { data, error } = await supabase.from('users').select('id').eq('role', target.role);
            if (error) throw error;
            userIds = data.map((u: any) => u.id);
        }
    }
    
    if (userIds.length === 0) {
        return new Response(JSON.stringify({ message: 'No target users found.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .in('user_id', userIds);
      
    if (subsError) throw subsError;

    const notificationPayload = JSON.stringify(payload);

    const sendPromises = subscriptions.map((sub: any) => 
        webpush.sendNotification(sub.subscription, notificationPayload)
            .catch((err: any) => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription is no longer valid, delete it
                    console.log(`Subscription ${sub.id} is gone. Deleting.`);
                    return supabase.from('push_subscriptions').delete().eq('id', sub.id);
                } else {
                    console.error('Failed to send notification:', err.statusCode, err.body);
                    // Return the error to be logged by Promise.allSettled
                    return Promise.reject(err);
                }
            })
    );

    const results = await Promise.allSettled(sendPromises);
    const failedCount = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({ 
        success: true, 
        sent: subscriptions.length - failedCount, 
        failed: failedCount 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in edge function:', err);
    // Cast 'err' to 'Error' to safely access the 'message' property.
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
