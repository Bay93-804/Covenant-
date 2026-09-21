// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user's auth.users row (and, via the
// `on delete cascade` foreign keys written into every migration under
// supabase/migrations/ — profiles, program_enrollments, workout_sessions,
// completed_sets, readiness_entries, safety_adjustments, testing_sessions,
// testing_results, exercise_maxes, personal_records, sport_sessions,
// journal_entries, notification_preferences — every row that table owns).
//
// Why this has to be a server-side function rather than a client call:
// deleting an `auth.users` row requires the Supabase Admin API
// (`auth.admin.deleteUser`), which requires the service-role key. The
// service-role key must never ship inside the mobile app (see
// src/lib/env.ts and mobile/README.md's "Environment variables" section) —
// this function is the one place that key is allowed to exist, and it lives
// only in this function's Supabase-managed environment, never in git.
//
// NOT DEPLOYED as part of Phase 5 — deploying requires explicit
// authorization and a real Supabase project. See
// docs/phase5/RELEASE_GUIDE.md's "Deploying the delete-account function"
// section for the exact `supabase functions deploy` command and the
// required project secrets.
//
// Auth model: the client calls this with its own (anon-key-issued) user
// access token in the `Authorization` header — the same token every other
// authenticated request already carries. This function verifies that token
// against Supabase Auth (proving "this really is the signed-in user, not
// someone guessing a user id") before doing anything, then uses the
// separate service-role client only for the actual deletion. A caller can
// only ever delete their own account; there is no user-id parameter this
// function accepts or trusts.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify the caller's own token identifies a real, current session —
  // using the anon-key client (not the admin one) is what makes this a
  // genuine verification rather than a self-reported user id.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: getUserError,
  } = await callerClient.auth.getUser();

  if (getUserError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
