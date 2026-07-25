import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getUploadPresignedUrl } from '@/lib/b2';
import crypto from 'crypto';

function verifySignature(apiKey: string, userId: string, email: string, signature: string): boolean {
  if (userId.startsWith('anon:') && signature === 'anonymous') {
    return true;
  }
  const message = `${userId}:${email}`;
  const computedSignature = crypto
    .createHmac('sha256', apiKey)
    .update(message)
    .digest('hex');
  return computedSignature === signature;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, userId, email, signature, filename, filetype } = body;

    if (!projectId || !userId || !email || !signature || !filename || !filetype) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch project config & API Key
    const { data: project, error: projectError } = await supabase
      .from('tbl_chat_projects')
      .select('tp_api_key, tp_status_flag, tp_deleted_flag')
      .eq('tp_id', projectId)
      .single();

    if (projectError || !project || !project.tp_status_flag || project.tp_deleted_flag) {
      return NextResponse.json({ success: false, error: 'Project not found or inactive' }, { status: 404 });
    }

    // 2. Verify identity signature
    const isVerified = verifySignature(project.tp_api_key, userId, email, signature);
    if (!isVerified) {
      return NextResponse.json({ success: false, error: 'Invalid identity signature' }, { status: 403 });
    }

    // 3. Generate a clean and safe unique path key
    // Strip special characters from filename to avoid S3 object key issues
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const randomUuid = crypto.randomUUID();
    const fileKey = `${projectId}/${userId}/${Date.now()}-${randomUuid}-${safeFilename}`;

    // 4. Generate pre-signed PUT URL (valid for 15 minutes / 900 seconds)
    const uploadUrl = await getUploadPresignedUrl(fileKey, filetype, 900);

    return NextResponse.json({
      success: true,
      uploadUrl,
      fileKey,
    });
  } catch (error) {
    console.error('[API Widget Upload Presign Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
