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
  try {
    webpush.setVapidDetails(
      'mailto:support@prohappyassignments.com',
      vapidPublicKey,
      vapidPrivateKey
    );
  } catch (error) {
    console.error('Error setting VAPID details:', error);
  }
}

// req is typed as 'any' because with 'Deno' being 'any', type inference for the request object is lost.
Deno.serve(async (req: any) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Check if VAPID keys are configured
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ 
        error: 'Push notifications not configured. VAPID keys missing.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

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
        if (!target.role || target.role === 'all') {
            const { data, error } = await supabase.from('users').select('id');
            if (error) {
                console.error('Error fetching all users:', error);
                throw new Error('Failed to fetch users');
            }
            userIds = data?.map((u: any) => u.id) || [];
        } else {
            const { data, error } = await supabase.from('users').select('id').eq('role', target.role);
            if (error) {
                console.error('Error fetching users by role:', error);
                throw new Error(`Failed to fetch users with role: ${target.role}`);
            }
            userIds = data?.map((u: any) => u.id) || [];
        }
    }
    
    if (userIds.length === 0) {
        return new Response(JSON.stringify({ message: 'No target users found.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    // Check if push_subscriptions table exists and get subscriptions
    let subscriptions: any[] = [];
    try {
      const { data, error: subsError } = await supabase
        .from('push_subscriptions')
        .select('id, subscription')
        .in('user_id', userIds);
        
      if (subsError) {
        console.warn('Push subscriptions table not found or error:', subsError);
        // Continue without push notifications but log the notification
      } else {
        subscriptions = data || [];
      }
    } catch (error) {
      console.warn('Push subscriptions not available:', error);
    }

    // Log notification to notification_history table
    try {
      const notificationPromises = userIds.map(userId => 
        supabase.from('notification_history').insert({
          user_id: userId,
          title: payload.title,
          body: payload.body,
          delivery_status: subscriptions.length > 0 ? 'pending' : 'sent',
          created_at: new Date().toISOString()
        })
      );
      
      await Promise.allSettled(notificationPromises);
    } catch (error) {
      console.warn('Failed to log notifications:', error);
    }

    // If no push subscriptions, return success (notifications logged)
    if (subscriptions.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Notifications logged successfully. No push subscriptions found.',
        sent: 0, 
        failed: 0,
        logged: userIds.length
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

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
        failed: failedCount,
        logged: userIds.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (err) {
    console.error('Error in edge function:', err);
    
    // Provide more specific error messages
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (err instanceof Error) {
      errorMessage = err.message;
      
      // Handle specific error types
      if (err.message.includes('Failed to fetch users')) {
        statusCode = 400;
        errorMessage = 'Invalid user role or database error';
      } else if (err.message.includes('Invalid request')) {
        statusCode = 400;
      }
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
