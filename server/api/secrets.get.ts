import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { decrypt } from '../utils/encryption'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const client = await serverSupabaseClient(event)
  const query = getQuery(event)
  const clientId: any = query.client_id

  const { data, error } = await client
    .from('secrets')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // DECRYPT VALUES BEFORE SENDING TO FRONTEND
  return data.map((secret: any) => ({
    ...secret,
    value: decrypt(secret.value) // Turning gibberish back into text
  }))
})