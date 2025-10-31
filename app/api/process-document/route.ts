import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFile } from "@/lib/file-storage";
import { getAzureClient } from "@/lib/azure-client";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Process document request received');
    
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      console.error('❌ No document ID provided');
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    console.log(`📋 Processing document: ${documentId}`);

    // Get document from database (no user check needed for internal call)
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      console.error(`❌ Document not found: ${documentId}`);
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    console.log(`📄 Found document: ${document.fileName}`);

    // Update status to processing
    await prisma.document.update({
      where: { id: documentId },
      data: { processingStatus: "PROCESSING" }
    });
    
    console.log(`⏳ Status updated to PROCESSING`);

    try {
      // Read file from local storage
      console.log(`📂 Loading file from storage: ${document.cloudStoragePath}`);
      const fileBuffer = await getFile(document.cloudStoragePath);
      console.log(`✅ File loaded successfully (${fileBuffer.length} bytes)`);

      // Process with Azure Document Intelligence
      console.log(`🔵 Initializing Azure client...`);
      const azureClient = getAzureClient();
      
      console.log(`📄 Starting Azure analysis for document type: ${document.documentType}`);
      const result = await azureClient.analyzeDocument(
        fileBuffer, 
        document.documentType
      );
      
      console.log(`✅ Azure analysis completed`);
      const extractedFields = azureClient.extractFieldsFromResult(result);
      
      console.log(`🎯 Processing results for ${document.fileName}:`);
      console.log(`   - Model used: ${result.modelUsed}`);
      console.log(`   - Documents found: ${result.documents?.length || 0}`);
      console.log(`   - Total fields extracted: ${extractedFields.length}`);

      // Save extracted data to database
      console.log(`💾 Saving ${extractedFields.length} fields to database...`);
      const extractedDataPromises = extractedFields.map(field =>
        prisma.extractedData.create({
          data: {
            documentId: document.id,
            fieldName: field.fieldName,
            fieldValue: field.fieldValue,
            confidence: field.confidence,
          }
        })
      );

      await Promise.all(extractedDataPromises);
      console.log(`✅ All fields saved to database`);

      // Calculate overall confidence from documents
      const overallConfidence = result.documents.length > 0 
        ? result.documents.reduce((sum, doc) => sum + doc.confidence, 0) / result.documents.length 
        : 0;
      
      console.log(`📊 Overall document confidence: ${Math.round(overallConfidence * 100)}%`);

      // Update document status to completed
      await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: "COMPLETED",
          processedAt: new Date(),
          confidence: overallConfidence
        }
      });
      
      console.log(`✅ Document processing completed successfully!`);

      return NextResponse.json({
        message: "Document processed successfully",
        extractedFields: extractedFields
      });

    } catch (processingError) {
      console.error("❌ Processing error:", processingError);
      console.error("❌ Error details:", processingError instanceof Error ? processingError.message : String(processingError));
      
      // Update document status to failed
      await prisma.document.update({
        where: { id: documentId },
        data: {
          processingStatus: "FAILED",
          errorMessage: processingError instanceof Error ? processingError.message : "Processing failed"
        }
      });

      return NextResponse.json(
        { error: "Document processing failed", details: processingError instanceof Error ? processingError.message : String(processingError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("❌ Process document error:", error);
    console.error("❌ Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
