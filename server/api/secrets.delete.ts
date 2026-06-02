import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = serverSupabaseServiceRole(event)
  const { id } = getQuery(event) as { id: string }
  
  if (!id) throw createError({ statusCode: 400, message: 'id is required' })

  // Verify ownership before deleting
  const { data: secret } = await supabase
    .from('secrets')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!secret || secret.user_id !== user.sub) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const { error } = await supabase.from('secrets').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, message: error.message })
  
  return { success: true }
})