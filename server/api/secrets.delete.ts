import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const client = await serverSupabaseClient(event)
  const query = getQuery(event)
  const secretId: any = query.id

  const { error } = await client.from('secrets').delete().eq('id', secretId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { success: true }
})