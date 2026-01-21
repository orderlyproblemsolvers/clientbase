import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { encrypt } from '../utils/encryption'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const client = await serverSupabaseClient(event)
  const body = await readBody(event)

  if (!body.client_id || !body.key_name || !body.value) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fields' })
  }

  // ENCRYPT THE VALUE BEFORE SAVING
  const encryptedValue = encrypt(body.value)

  const { data, error } = await client.from('secrets').insert({
    client_id: body.client_id,
    key_name: body.key_name,
    value: encryptedValue // Saving gibberish to DB
  }).select()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data
})