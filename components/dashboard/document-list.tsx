
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Eye,
  Calendar,
  Trash2
} from "lucide-react";

interface Document {
  id: string;
  fileName: string;
  documentType: string;
  processingStatus: string;
  uploadedAt: string;
  confidence?: number;
  extractedData: Array<{
    fieldName: string;
    fieldValue: string | null;
    confidence: number;
  }>;
}

interface DocumentListProps {
  documents: Document[];
  onRefresh: () => void;
}

export default function DocumentList({ documents, onRefresh }: DocumentListProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [deletingDocuments, setDeletingDocuments] = useState<Set<string>>(new Set());
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'PROCESSING':
        return <Clock className="h-4 w-4 text-orange-600" />;
      case 'FAILED':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PROCESSING':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      W2: "W-2",
      FORM_1099_DIV: "1099-DIV",
      FORM_1099_MISC: "1099-MISC",
      FORM_1099_INT: "1099-INT",
      FORM_1099_NEC: "1099-NEC",
      FORM_1040: "1040",
      OTHER: "Other"
    };
    return typeMap[type] || type;
  };

  const getConfidenceColor = (confidence: number | undefined) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-orange-600';
    return 'text-red-600';
  };

  const handleDeleteDocument = async (document: Document) => {
    setDeletingDocuments(prev => new Set(prev).add(document.id));
    
    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onRefresh(); // Refresh the document list
        setDocumentToDelete(null); // Close confirmation dialog
      } else {
        const error = await response.json();
        console.error('Delete failed:', error.error);
        // You could show a toast notification here
        alert('Failed to delete document: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setDeletingDocuments(prev => {
        const newSet = new Set(prev);
        newSet.delete(document.id);
        return newSet;
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Documents
            </CardTitle>
            <CardDescription>
              {documents?.length || 0} document{documents?.length !== 1 ? 's' : ''} uploaded
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!documents || documents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">No Documents Uploaded</h3>
            <p className="text-sm text-muted-foreground">
              Upload your first tax document to get started with processing.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {documents.map((document, index) => (
              <motion.div
                key={document.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="font-medium truncate">{document.fileName}</p>
                            <Badge variant="secondary" className="text-xs">
                              {getDocumentTypeLabel(document.documentType)}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(document.uploadedAt)}</span>
                            </div>
                            
                            {document.confidence !== undefined && (
                              <div className={`flex items-center space-x-1 ${getConfidenceColor(document.confidence)}`}>
                                <span className="text-xs font-medium">
                                  {Math.round(document.confidence * 100)}% confidence
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Badge className={`text-xs ${getStatusColor(document.processingStatus)}`}>
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(document.processingStatus)}
                            <span>{document.processingStatus}</span>
                          </div>
                        </Badge>

                        {/* Warning badge for completed documents with no data */}
                        {document.processingStatus === 'COMPLETED' && (!document.extractedData || document.extractedData.length === 0) && (
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            No Data
                          </Badge>
                        )}

                        <div className="flex items-center space-x-1">
                          {document.processingStatus === 'COMPLETED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDocument(document)}
                              title={document.extractedData?.length > 0 ? "View extracted data" : "View document details (no data extracted)"}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDocumentToDelete(document)}
                            disabled={deletingDocuments.has(document.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete document"
                          >
                            {deletingDocuments.has(document.id) ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Document Details Modal */}
        <AnimatePresence>
          {selectedDocument && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedDocument(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {selectedDocument.fileName} - Extracted Data
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDocument(null)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                  {selectedDocument.extractedData?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDocument.extractedData.map((field, index) => {
                        // Parse field value if it's a JSON string
                        let displayValue = field.fieldValue || 'No value';
                        
                        // Try to make the display value more readable
                        if (displayValue.startsWith('{') || displayValue.startsWith('[')) {
                          try {
                            // It might be a JSON string - try to extract meaningful data
                            const parsed = JSON.parse(displayValue);
                            
                            // For objects with value property
                            if (parsed.value !== undefined) {
                              if (typeof parsed.value === 'object' && parsed.value.valueNumber !== undefined) {
                                displayValue = String(parsed.value.valueNumber);
                              } else if (typeof parsed.value === 'object' && parsed.value.valueString !== undefined) {
                                displayValue = String(parsed.value.valueString);
                              } else if (typeof parsed.value !== 'object') {
                                displayValue = String(parsed.value);
                              }
                            }
                          } catch (e) {
                            // Not JSON or couldn't parse - use as is
                          }
                        }

                        // Truncate very long values
                        const truncatedValue = displayValue.length > 100 
                          ? displayValue.substring(0, 100) + '...' 
                          : displayValue;

                        return (
                          <div key={index} className="flex justify-between items-start py-2 border-b border-gray-100">
                            <span className="font-medium text-sm mr-4 min-w-[150px]">{field.fieldName}:</span>
                            <div className="text-right flex-1">
                              <span className="text-sm break-words" title={displayValue}>
                                {truncatedValue}
                              </span>
                              <div className={`text-xs mt-1 ${getConfidenceColor(field.confidence)}`}>
                                {Math.round(field.confidence * 100)}% confidence
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-2">
                        No extracted data available for this document.
                      </p>
                      <p className="text-sm text-gray-500">
                        This may indicate the document was processed but no fields were recognized,
                        or the document format wasn't compatible with the selected document type.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {documentToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setDocumentToDelete(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-lg max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="p-3 bg-red-100 rounded-full">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Delete Document
                      </h3>
                      <p className="text-sm text-gray-500">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-gray-700">
                      Are you sure you want to delete{' '}
                      <span className="font-medium">"{documentToDelete.fileName}"</span>?
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      This will permanently remove the document and all extracted data.
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-end space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => setDocumentToDelete(null)}
                      disabled={deletingDocuments.has(documentToDelete.id)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteDocument(documentToDelete)}
                      disabled={deletingDocuments.has(documentToDelete.id)}
                    >
                      {deletingDocuments.has(documentToDelete.id) ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Document
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
