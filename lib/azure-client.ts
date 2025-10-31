import DocumentIntelligence from '@azure-rest/ai-document-intelligence';
import { AzureKeyCredential } from '@azure/core-auth';

// Map DocumentType enum to Azure model IDs
function getAzureModelId(documentType: string): string {
  const modelMap: Record<string, string> = {
    'W2': 'prebuilt-tax.us.w2',
    'FORM_1040': 'prebuilt-tax.us.1040',
    'FORM_1099': 'prebuilt-tax.us.1099nec',
    'INVOICE': 'prebuilt-invoice',
    'RECEIPT': 'prebuilt-receipt',
    'OTHER': 'prebuilt-document',  // Generic fallback
  };

  return modelMap[documentType] || 'prebuilt-document';
}

// Export the mapping function
export { getAzureModelId };

// Define types based on Azure SDK
export interface ExtractedField {
  fieldName: string;
  fieldValue: any;
  confidence: number;
  type?: string;
}

export interface ProcessedDocument {
  docType: string;
  confidence: number;
  fields: ExtractedField[];
}

export interface AzureDocumentAnalysisResult {
  status: string;
  documents: ProcessedDocument[];
  modelUsed: string;
}

export class AzureDocumentClient {
  private client: ReturnType<typeof DocumentIntelligence> | null = null;
  private endpoint: string = "";
  private apiKey: string = "";
  private initialized: boolean = false;

  constructor() {
    // Don't initialize during construction - wait until runtime
    // This prevents build-time errors when environment variables aren't available
  }

  private ensureInitialized(): void {
    // Lazy initialization - only create client when first method is called at runtime
    if (this.initialized) {
      return;
    }

    this.endpoint = process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT || "";
    this.apiKey = process.env.AZURE_DOC_INTELLIGENCE_API_KEY || "";
    
    if (!this.apiKey || !this.endpoint) {
      throw new Error("Azure Document Intelligence API key and endpoint must be configured");
    }

    // Create the Azure Document Intelligence REST client
    this.client = DocumentIntelligence(this.endpoint, new AzureKeyCredential(this.apiKey));
    
    this.initialized = true;
    console.log("✅ Azure Document Intelligence client initialized");
  }

  async analyzeDocument(fileBuffer: Buffer, modelId: string = "prebuilt-tax.us.w2"): Promise<AzureDocumentAnalysisResult> {
    this.ensureInitialized();
    
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    console.log(`📄 Starting document analysis with model: ${modelId}`);
    
    try {
      // Start the analysis operation
      const initialResponse = await this.client.path("/documentModels/{modelId}:analyze", modelId).post({
        contentType: "application/json",
        body: {
          base64Source: fileBuffer.toString('base64')
        },
        queryParameters: {
          features: ["keyValuePairs"]
        }
      });

      if (initialResponse.status !== "202") {
        throw new Error(`Failed to start analysis: ${initialResponse.status}`);
      }

      // Get the operation location from headers
      const operationLocation = initialResponse.headers['operation-location'];
      if (!operationLocation) {
        throw new Error("No operation location in response");
      }

      // Extract result ID from operation location
      const resultId = operationLocation.split('/').pop()?.split('?')[0];
      if (!resultId) {
        throw new Error("Could not extract result ID");
      }

      console.log(`⏳ Analysis started, polling for results...`);

      // Poll for results
      let result;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const pollingResponse = await this.client.path("/documentModels/{modelId}/analyzeResults/{resultId}", modelId, resultId).get();
        
        if (pollingResponse.status === "200") {
          const body = pollingResponse.body as any;
          
          if (body.status === "succeeded") {
            result = body;
            console.log(`✅ Analysis completed successfully`);
            break;
          } else if (body.status === "failed") {
            throw new Error(`Analysis failed: ${body.error?.message || 'Unknown error'}`);
          }
          // If still running, continue polling
        }
        
        attempts++;
      }

      if (!result) {
        throw new Error("Analysis timed out");
      }

      // Process the result
      const processedDocuments: ProcessedDocument[] = [];
      
      if (result.analyzeResult?.documents) {
        for (const doc of result.analyzeResult.documents) {
          const fields: ExtractedField[] = [];
          
          if (doc.fields) {
            for (const [fieldName, field] of Object.entries(doc.fields)) {
              const extractedField = this.extractFieldValue(field);
              fields.push({
                fieldName,
                fieldValue: extractedField,
                confidence: extractedField?.confidence || 0,
                type: extractedField?.type || 'simple'
              });
            }
          }

          processedDocuments.push({
            docType: doc.docType || 'unknown',
            confidence: doc.confidence || 0,
            fields
          });
        }
      }

      return {
        status: "success",
        documents: processedDocuments,
        modelUsed: modelId
      };

    } catch (error: any) {
      console.error("❌ Error analyzing document:", error);
      throw new Error(`Document analysis failed: ${error.message}`);
    }
  }

  private extractFieldValue(field: any): any {
    if (!field) return null;

    return {
      value: field.content || field.valueString || field.valueNumber || field.valueDate || null,
      confidence: field.confidence || 0,
      type: field.type || 'string'
    };
  }

  extractFieldsFromResult(result: AzureDocumentAnalysisResult): Array<{ fieldName: string; fieldValue: string | null; confidence: number }> {
    const fields: Array<{ fieldName: string; fieldValue: string | null; confidence: number }> = [];

    for (const doc of result.documents) {
      for (const field of doc.fields) {
        fields.push({
          fieldName: field.fieldName,
          fieldValue: field.fieldValue ? JSON.stringify(field.fieldValue, null, 2) : null,
          confidence: field.confidence,
        });
      }
    }

    return fields;
  }
}

// Lazy initialization pattern - client is only created when first accessed
let azureClientInstance: AzureDocumentClient | null = null;

export function getAzureClient(): AzureDocumentClient {
  if (!azureClientInstance) {
    azureClientInstance = new AzureDocumentClient();
  }
  return azureClientInstance;
}
