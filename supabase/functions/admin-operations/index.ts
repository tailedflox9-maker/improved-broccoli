// supabase/functions/admin-operations/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client with service role (server-side only)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the requesting user is actually an admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Get user's profile to verify admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    const { action, ...body } = await req.json()

    switch (action) {
      case 'createUser':
        return await createUser(supabaseAdmin, body)
      case 'getAllUsers':
        return await getAllUsers(supabaseAdmin)
      case 'assignTeacher':
        return await assignTeacher(supabaseAdmin, body)
      case 'deleteConversation':
        return await deleteConversation(supabaseAdmin, body)
      case 'getUserConversations':
        return await getUserConversations(supabaseAdmin, body)
      case 'getMessages':
        return await getMessages(supabaseAdmin, body)
      default:
        return new Response('Invalid action', { status: 400, headers: corsHeaders })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function createUser(supabaseAdmin: any, userData: any) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
    user_metadata: { 
      full_name: userData.full_name, 
      role: userData.role 
    }
  })

  if (authError) throw authError

  return new Response(JSON.stringify({ user: authData.user }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getAllUsers(supabaseAdmin: any) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function assignTeacher(supabaseAdmin: any, body: any) {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ teacher_id: body.teacherId })
    .eq('id', body.studentId)

  if (error) throw error

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function deleteConversation(supabaseAdmin: any, body: any) {
  const { error } = await supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', body.conversationId)

  if (error) throw error

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getUserConversations(supabaseAdmin: any, body: any) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('user_id', body.userId)
    .order('updated_at', { ascending: false })

  if (error) throw error

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getMessages(supabaseAdmin: any, body: any) {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', body.conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
