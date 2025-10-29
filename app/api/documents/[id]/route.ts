import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/file-storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const document = await prisma.document.findUnique({
      where: { id: params.id },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete file from storage (with error handling)
    try {
      await deleteFile(document.cloudStoragePath);
    } catch (fileError: any) {
      // If file doesn't exist (ENOENT), just log a warning and continue
      if (fileError.code === 'ENOENT') {
        console.warn(`File not found, skipping deletion: ${document.cloudStoragePath}`);
      } else {
        // For other errors, log but don't fail the deletion
        console.error('Error deleting file from storage:', fileError);
      }
      // Continue with database deletion regardless of file deletion result
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
