import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { encrypt } from '../utils/crypto'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = serverSupabaseServiceRole(event)
  const config   = useRuntimeConfig()
  const encKey   = config.secretsEncryptionKey

  const body = await readBody(event)
  const { user_id, client_id, project_id, key_name, value } = body

  if (!user_id) {
    throw createError({statusCode: 400, message: 'Not a valid user'})
  }
  if (!key_name || !value) {
    throw createError({ statusCode: 400, message: 'key_name and value are required' })
  }
  if (!client_id && !project_id) {
    throw createError({ statusCode: 400, message: 'client_id or project_id required' })
  }

  const safeUserId  = user_id  && user_id  !== 'null' && user_id  !== 'undefined' ? user_id  : null
  const safeClientId  = client_id  && client_id  !== 'null' && client_id  !== 'undefined' ? client_id  : null
  const safeProjectId = project_id && project_id !== 'null' && project_id !== 'undefined' ? project_id : null

  const { error } = await supabase.from('secrets').insert({
    user_id:    safeUserId,
    client_id:  safeClientId,
    project_id: safeProjectId,
    key_name,
    value: encrypt(value, encKey),
  })

  if (error) throw createError({ statusCode: 500, message: error.message })
  return { success: true }
})