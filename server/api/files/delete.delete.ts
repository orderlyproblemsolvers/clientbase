import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { getB2Client } from '../../utils/b2Client'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const userId = user.sub ?? user.id
  if (!userId) throw createError({ statusCode: 401, message: 'Could not resolve user ID' })

  const { fileId } = getQuery(event)
  if (!fileId) throw createError({ statusCode: 400, message: 'Missing fileId' })

  const supabase = await serverSupabaseClient(event)

  // Ownership check before doing anything
  const { data: file, error } = await supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single()

  if (error || !file) {
    throw createError({ statusCode: 404, message: 'File not found or access denied' })
  }

  const config = useRuntimeConfig()
  const client = getB2Client()

  // Delete from B2 first
  await client.send(new DeleteObjectCommand({
    Bucket: config.b2BucketName,
    Key:    file.file_path,
  }))

  // Then remove the metadata record
  await supabase.from('files').delete().eq('id', fileId)

  return { success: true }
})