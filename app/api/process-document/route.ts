import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processDocument } from '@/lib/azure-client';
import { getFile } from '@/lib/file-storage';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { documentId } = await request.json();

    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    const fileBuffer = await getFile(document.fileUrl);
    const result = await processDocument(fileBuffer, document.type);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        confidence: result.confidence,
      },
    });

    await prisma.extractedData.create({
      data: {
        documentId,
        fields: result.fields,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
