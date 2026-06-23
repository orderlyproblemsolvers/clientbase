import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { serverSupabaseClient } from '#supabase/server'
import { getB2Client } from '../../utils/b2Client'

export default defineEventHandler(async (event) => {
  const { fileId, token } = getQuery(event)

  if (!fileId || !token) {
    throw createError({ statusCode: 400, message: 'Missing fileId or token' })
  }

  const supabase = await serverSupabaseClient(event)

  // Verify the token is valid and get the project id it belongs to
  const { data: projectData, error: projectError } = await supabase
    .rpc('get_shared_project', { p_share_token: token })

  if (projectError || !projectData?.length) {
    throw createError({ statusCode: 403, message: 'Invalid or expired share token' })
  }

  const projectId = projectData[0].id

  // Verify the file actually belongs to this project
  // Uses the get_shared_files RPC so it respects the same visibility rules
  const { data: sharedFiles, error: filesError } = await supabase
    .rpc('get_shared_files', { p_project_id: projectId })

  if (filesError) {
    throw createError({ statusCode: 500, message: filesError.message })
  }

  const file = (sharedFiles || []).find((f: any) => f.id === fileId)

  if (!file) {
    throw createError({ statusCode: 404, message: 'File not found or not accessible via this link' })
  }

  const config = useRuntimeConfig()
  const client = getB2Client()

  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.b2BucketName,
      Key:    file.file_path,
    }),
    { expiresIn: 300 } // 5 min — enough for preview + download
  )

  return { signedUrl, fileName: file.file_name, fileType: file.file_type }
})