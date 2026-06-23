import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
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

  // Ownership check — only the user who uploaded can download
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

  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.b2BucketName,
      Key:    file.file_path,
    }),
    { expiresIn: 60 }
  )

  return { signedUrl }
})