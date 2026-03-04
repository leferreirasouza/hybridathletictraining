import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin or master_admin
    const authHeader = req.headers.get('Authorization')!;
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error('Unauthorized');

    const { email, full_name, role, organization_id } = await req.json();
    if (!email || !role || !organization_id) {
      throw new Error('email, role, and organization_id are required');
    }

    // Check caller has permission (master_admin or admin in the org)
    const { data: callerRoles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('organization_id', organization_id);

    const callerRole = callerRoles?.[0]?.role;
    const isMasterAdmin = callerRoles?.some(r => r.role === 'master_admin') ||
      (await adminClient.from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'master_admin')).data?.length;

    if (!isMasterAdmin && callerRole !== 'admin') {
      throw new Error('Only admins can invite users');
    }

    // Admin can only create coach/athlete, not other admins
    if (!isMasterAdmin && role === 'admin') {
      throw new Error('Only master admins can create admin accounts');
    }

    // Create or get user
    let userId: string;
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === email);

    if (existing) {
      userId = existing.id;
    } else {
      // Invite user (sends magic link email)
      const { data: invited, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: full_name || '' },
      });
      if (inviteErr) throw inviteErr;
      userId = invited.user.id;
    }

    // Assign role to org
    const { error: roleErr } = await adminClient.from('user_roles').insert({
      user_id: userId,
      organization_id,
      role,
    });

    if (roleErr) {
      if (roleErr.message.includes('duplicate')) {
        throw new Error('User already has a role in this organization');
      }
      throw roleErr;
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('invite-user error:', e);
    const safeMessages = [
      'Unauthorized',
      'email, role, and organization_id are required',
      'Only admins can invite users',
      'Only master admins can create admin accounts',
      'User already has a role in this organization',
    ];
    const message = safeMessages.includes(e.message) ? e.message : 'An error occurred processing your request';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
