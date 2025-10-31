import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile } from '@/lib/file-storage';
import { DocumentType } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Upload request received');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📄 Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/tiff'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = await uploadFile(buffer, file.name, file.type);
    
    console.log(`✅ File uploaded to storage: ${fileName}`);

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    const document = await prisma.document.create({
      data: {
        fileName,
        originalFileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        cloudStoragePath: fileName,
        documentType: (type as DocumentType) || DocumentType.OTHER,
        userId: user!.id,
      },
    });
    
    console.log(`✅ Document created in database: ${document.id}`);

    // ✅ TRIGGER PROCESSING AUTOMATICALLY
    console.log(`🔄 Triggering document processing for: ${document.id}`);
    
    // Call process-document endpoint in the background
    fetch(`${process.env.NEXTAUTH_URL}/api/process-document`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({ documentId: document.id })
    }).catch(error => {
      console.error('❌ Failed to trigger processing:', error);
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error('❌ Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
