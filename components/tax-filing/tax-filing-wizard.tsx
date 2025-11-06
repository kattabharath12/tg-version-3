
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight } from "lucide-react";
import GettingStartedStep from "./getting-started-step";
import PersonalInfoStep from "./personal-info-step";
import EnhancedIncomeStep from "./enhanced-income-step";
import DeductionStep from "./deduction-step";
import Form1040Step from "./form-1040-step";
import TaxCalculationStep from "./tax-calculation-step";
import ReviewStep from "./review-step";
import FilingStep from "./filing-step";

interface Document {
  id: string;
  filename: string;
  fileName: string;
  originalFileName: string;
  documentType: string;
  extractedData: any;
  confidence: number;
  uploadedAt: string;
  cloud_storage_path: string;
}

interface TaxData {
  personalInfo: {
    firstName: string;
    lastName: string;
    ssn: string;
    address: string;
    street: string;
    unit: string;
    city: string;
    state: string;
    zip: string;
    filingStatus: string;
    dependents: number;
  };
  income: {
    wages: number;
    interest: number;
    dividends: number;
    other: number;
  };
  withholdings: {
    federalTax: number;
    stateTax: number;
    socialSecurityTax: number;
    medicareTax: number;
  };
  deductions: {
    standard: number;
    itemized: number;
    useStandard: boolean;
  };
  taxCalculation: {
    taxableIncome: number;
    federalTax: number;
    refund: number;
  };
  breakdown?: any; // Document breakdown information
  mathematicalBreakdown?: any; // Mathematical calculation breakdown
}

const STEPS = [
  { id: "getting-started", title: "Getting Started", component: GettingStartedStep },
  { id: "personal-info", title: "Personal Info", component: PersonalInfoStep },
  { id: "income", title: "Income", component: EnhancedIncomeStep },
  { id: "deductions", title: "Deductions", component: DeductionStep },
  { id: "form-1040", title: "Form 1040", component: Form1040Step },
  { id: "tax-calculation", title: "Tax Calculation", component: TaxCalculationStep },
  { id: "review", title: "Review", component: ReviewStep },
  { id: "filing", title: "Filing", component: FilingStep },
];

export default function TaxFilingWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataExtractionStatus, setDataExtractionStatus] = useState<'idle' | 'extracting' | 'completed' | 'error'>('idle');
  
  const [taxData, setTaxData] = useState<TaxData>({
    personalInfo: {
      firstName: "",
      lastName: "",
      ssn: "",
      address: "",
      street: "",
      unit: "",
      city: "",
      state: "",
      zip: "",
      filingStatus: "single",
      dependents: 0,
    },
    income: {
      wages: 0,
      interest: 0,
      dividends: 0,
      other: 0,
    },
    withholdings: {
      federalTax: 0,
      stateTax: 0,
      socialSecurityTax: 0,
      medicareTax: 0,
    },
    deductions: {
      standard: 13850, // 2025 standard deduction for single filer
      itemized: 0,
      useStandard: true,
    },
    taxCalculation: {
      taxableIncome: 0,
      federalTax: 0,
      refund: 0,
    },
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setError(null);
      const response = await fetch("/api/documents");
      
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const documentsToUse = data.documents || [];
      
      console.log(`🔍 Loaded ${documentsToUse.length} documents from database`);
      
      setDocuments(documentsToUse);
      
      // Auto-populate tax data from extracted documents
      if (documentsToUse.length > 0) {
        await populateTaxDataFromDocuments(documentsToUse);
      } else {
        setLoading(false);
      }
      
    } catch (error) {
      console.error("Error fetching documents:", error);
      setError(error instanceof Error ? error.message : "Failed to load documents");
      setDocuments([]);
      setLoading(false);
    }
  };

  // Helper function to extract value from Azure Document Intelligence nested structure
  const extractValueFromAzureField = (fieldValue: any): { value: any, confidence: number } => {
    if (!fieldValue) return { value: null, confidence: 0 };
    
    try {
      let parsed = fieldValue;
      if (typeof fieldValue === 'string') {
        parsed = JSON.parse(fieldValue);
      }
      
      // Handle nested Azure Document Intelligence structure
      if (parsed && typeof parsed === 'object') {
        let extractedValue = null;
        let confidence = parsed.confidence || 0;
        
        // Check for value.valueNumber (most common for numbers)
        if (parsed.value && typeof parsed.value.valueNumber === 'number') {
          extractedValue = parsed.value.valueNumber;
        }
        // Check for value.valueString (strings)
        else if (parsed.value && typeof parsed.value.valueString === 'string') {
          extractedValue = parsed.value.valueString;
        }
        // Check for direct valueNumber
        else if (typeof parsed.valueNumber === 'number') {
          extractedValue = parsed.valueNumber;
        }
        // Check for direct valueString
        else if (typeof parsed.valueString === 'string') {
          extractedValue = parsed.valueString;
        }
        // Check for direct value
        else if (parsed.value !== undefined) {
          extractedValue = parsed.value;
        }
        // Fallback to the parsed object itself
        else {
          extractedValue = parsed;
        }
        
        return { value: extractedValue, confidence };
      }
      
      // Direct value
      return { value: parsed, confidence: 1.0 };
      
    } catch (e) {
      // If not JSON, return as-is
      return { value: fieldValue, confidence: 1.0 };
    }
  };

  const populateTaxDataFromDocuments = async (docs: Document[]) => {
    try {
      setLoading(true);
      setDataExtractionStatus('extracting');
      setError(null);
      
      console.log(`🔍 Senior Azure Document Intelligence Developer: Processing ${docs.length} documents...`);
      
      // Direct extraction from documents for immediate auto-population
      const updatedTaxData = { ...taxData };
      let fieldsExtracted = 0;
      
      // Process W-2 documents for personal information with PROPER Azure parsing
      const w2Docs = docs.filter(doc => doc.documentType === 'W2' && (doc.confidence || 0) > 0.1);
      
      if (w2Docs.length > 0) {
        console.log(`📋 Processing ${w2Docs.length} W-2 document(s) for personal information...`);
        
        // Use the W-2 with highest confidence for personal info
        const bestW2 = w2Docs.reduce((best, current) => 
          (current.confidence || 0) > (best.confidence || 0) ? current : best
        );
        
        const extractedData = bestW2.extractedData || [];
        console.log(`🔍 W-2 has ${extractedData.length} extracted fields`);
        
        extractedData.forEach((field: any) => {
          const fieldName = field.fieldName?.toLowerCase() || '';
          const rawFieldValue = field.fieldValue;
          
          console.log(`🔍 Processing field: ${field.fieldName} = ${rawFieldValue?.substring(0, 100)}...`);
          
          if (!rawFieldValue) return;
          
          // Handle Employee object with nested name, SSN, address data
          if (fieldName === 'employee') {
            try {
              const employeeData = JSON.parse(rawFieldValue);
              console.log(`📋 Employee data structure (Confidence: ${employeeData?.confidence || 0}):`, employeeData);
              
              // CRITICAL FIX: Accept employee data even with 0% confidence
              // Azure Document Intelligence sometimes returns 0% confidence for Employee objects
              // but the data is still valid and extractable
              console.log(`🔧 FIX APPLIED: Processing employee data regardless of confidence level`);
              
              // Try multiple extraction paths for robustness
              let nameExtracted = false;
              let ssnExtracted = false;
              let addressExtracted = false;
              
              // Extract name from nested structure - Try multiple paths
              if (!updatedTaxData.personalInfo.firstName) {
                // Path 1: Standard Azure nested structure
                let fullName = employeeData?.value?.Name?.value?.valueString;
                
                // Path 2: Alternative nesting
                if (!fullName) {
                  fullName = employeeData?.value?.Name?.valueString;
                }
                
                // Path 3: Direct value
                if (!fullName && employeeData?.value?.Name) {
                  fullName = employeeData.value.Name;
                }
                
                // Path 4: Check if Name is directly on the object
                if (!fullName && employeeData?.Name?.value?.valueString) {
                  fullName = employeeData.Name.value.valueString;
                }
                
                // Parse name if we found it
                if (fullName && typeof fullName === 'string') {
                  const { firstName, lastName } = parseName(fullName);
                  if (firstName) {
                    updatedTaxData.personalInfo.firstName = firstName;
                    updatedTaxData.personalInfo.lastName = lastName || '';
                    fieldsExtracted += 2;
                    nameExtracted = true;
                    console.log(`✅ Extracted name from Employee object: ${updatedTaxData.personalInfo.firstName} ${updatedTaxData.personalInfo.lastName} (from: ${fullName})`);
                  }
                }
              }
              
              // Extract SSN from nested structure - Try multiple paths
              if (!updatedTaxData.personalInfo.ssn) {
                // Path 1: Standard Azure nested structure
                let ssn = employeeData?.value?.SocialSecurityNumber?.value?.valueString;
                
                // Path 2: Alternative nesting
                if (!ssn) {
                  ssn = employeeData?.value?.SocialSecurityNumber?.valueString;
                }
                
                // Path 3: Direct value
                if (!ssn && employeeData?.value?.SocialSecurityNumber) {
                  ssn = employeeData.value.SocialSecurityNumber;
                }
                
                // Path 4: Check if SSN is directly on the object
                if (!ssn && employeeData?.SocialSecurityNumber?.value?.valueString) {
                  ssn = employeeData.SocialSecurityNumber.value.valueString;
                }
                
                if (ssn && typeof ssn === 'string') {
                  updatedTaxData.personalInfo.ssn = ssn;
                  fieldsExtracted++;
                  ssnExtracted = true;
                  console.log(`✅ Extracted SSN from Employee object: ${updatedTaxData.personalInfo.ssn}`);
                }
              }
              
              // Extract address from nested structure - Try multiple paths
              if (!updatedTaxData.personalInfo.address) {
                // Path 1: Standard Azure nested structure
                let addressData = employeeData?.value?.Address?.value;
                
                // Path 2: Alternative nesting
                if (!addressData) {
                  addressData = employeeData?.value?.Address;
                }
                
                // Path 3: Direct on object
                if (!addressData && employeeData?.Address?.value) {
                  addressData = employeeData.Address.value;
                }
                
                if (addressData) {
                  // Use individual address components directly from Azure (most accurate)
                  if (addressData.streetAddress) {
                    updatedTaxData.personalInfo.street = addressData.streetAddress;
                    fieldsExtracted++;
                    addressExtracted = true;
                    console.log(`✅ Extracted street from Azure components: ${updatedTaxData.personalInfo.street}`);
                  }
                  
                  if (addressData.city) {
                    updatedTaxData.personalInfo.city = addressData.city;
                    fieldsExtracted++;
                    addressExtracted = true;
                    console.log(`✅ Extracted city from Azure components: ${updatedTaxData.personalInfo.city}`);
                  }
                  
                  if (addressData.state) {
                    updatedTaxData.personalInfo.state = addressData.state;
                    fieldsExtracted++;
                    addressExtracted = true;
                    console.log(`✅ Extracted state from Azure components: ${updatedTaxData.personalInfo.state}`);
                  }
                  
                  if (addressData.postalCode) {
                    updatedTaxData.personalInfo.zip = addressData.postalCode;
                    fieldsExtracted++;
                    addressExtracted = true;
                    console.log(`✅ Extracted zip from Azure components: ${updatedTaxData.personalInfo.zip}`);
                  }
                  
                  // Build full address for display if components exist
                  if (updatedTaxData.personalInfo.street || updatedTaxData.personalInfo.city || updatedTaxData.personalInfo.state || updatedTaxData.personalInfo.zip) {
                    const addressParts = [];
                    if (updatedTaxData.personalInfo.street) addressParts.push(updatedTaxData.personalInfo.street);
                    if (updatedTaxData.personalInfo.city) addressParts.push(updatedTaxData.personalInfo.city);
                    if (updatedTaxData.personalInfo.state) addressParts.push(updatedTaxData.personalInfo.state);
                    if (updatedTaxData.personalInfo.zip) addressParts.push(updatedTaxData.personalInfo.zip);
                    updatedTaxData.personalInfo.address = addressParts.join(', ');
                    console.log(`✅ Built full address from Azure components: ${updatedTaxData.personalInfo.address}`);
                  }
                  
                  // Only fallback to parsing streetAddress if individual components aren't available
                  else if (addressData.streetAddress) {
                    const fullAddress = addressData.streetAddress;
                    updatedTaxData.personalInfo.address = fullAddress;
                    
                    // Parse address components as fallback
                    const { street, city, state, zip } = parseAddressComponents(fullAddress);
                    if (street) updatedTaxData.personalInfo.street = street;
                    if (city) updatedTaxData.personalInfo.city = city;
                    if (state) updatedTaxData.personalInfo.state = state;
                    if (zip) updatedTaxData.personalInfo.zip = zip;
                    
                    fieldsExtracted += street || city || state || zip ? 4 : 1;
                    console.log(`✅ Fallback: Parsed address components from streetAddress: ${fullAddress}`);
                  }
                }
              }
              
              // Log extraction summary
              if (nameExtracted || ssnExtracted || addressExtracted) {
                console.log(`✅ Successfully extracted from Employee object (0% confidence workaround): Name=${nameExtracted}, SSN=${ssnExtracted}, Address=${addressExtracted}`);
              } else {
                console.warn(`⚠️ Employee object found but no data could be extracted. Structure:`, JSON.stringify(employeeData).substring(0, 200));
              }
            } catch (parseError) {
              console.warn(`⚠️ Failed to parse Employee object:`, parseError);
            }
          }
          
          // Also check direct field mappings using Azure value extraction
          const extracted = extractValueFromAzureField(rawFieldValue);
          // CRITICAL FIX: Lowered confidence threshold from 0.3 to 0.0 to accept all data
          if (extracted.value && extracted.confidence >= 0.0) {
            console.log(`🔧 FIX APPLIED: Processing field with confidence ${extracted.confidence} (threshold: 0.0)`);
            
            // Extract wages for preview
            if (fieldName.includes('wagestipsandothercompensation') && 
                typeof extracted.value === 'number' && extracted.value > 0) {
              console.log(`✅ Found W-2 wages: $${extracted.value.toLocaleString()}`);
            }
          }
        });
      }

      // Call comprehensive tax data extraction API for income data
      try {
        const response = await fetch('/api/tax-data-extraction');
        
        if (response.ok) {
          const apiResult = await response.json();
          const { extractedTaxData, mathematicalBreakdown, taxCalculation } = apiResult;
          
          if (extractedTaxData && mathematicalBreakdown) {
            console.log('🎯 COMPREHENSIVE TAX DATA EXTRACTION RESULTS:');
            console.log('═══════════════════════════════════════════════');
            console.log(`📊 Documents Processed: ${mathematicalBreakdown.summary.documentsProcessed}/${mathematicalBreakdown.summary.totalDocumentsUploaded}`);
            console.log(`💯 Average Confidence: ${Math.round(mathematicalBreakdown.summary.averageConfidence * 100)}%`);
            
            // Merge comprehensive income data
            updatedTaxData.income = {
              wages: extractedTaxData.income.wages || 0,
              interest: extractedTaxData.income.interest || 0,
              dividends: extractedTaxData.income.dividends || 0,
              other: (extractedTaxData.income.nonEmployeeCompensation || 0) + 
                     (extractedTaxData.income.miscellaneousIncome || 0) + 
                     (extractedTaxData.income.rentalRoyalties || 0) + 
                     (extractedTaxData.income.other || 0),
            };

            // Extract personal info from the comprehensive API as fallback
            if (extractedTaxData.personalInfo) {
              if (extractedTaxData.personalInfo.name && !updatedTaxData.personalInfo.firstName) {
                const { firstName, lastName } = parseName(extractedTaxData.personalInfo.name);
                if (firstName) {
                  updatedTaxData.personalInfo.firstName = firstName;
                  updatedTaxData.personalInfo.lastName = lastName || '';
                  fieldsExtracted += 2;
                  console.log(`✅ Extracted name from API: ${updatedTaxData.personalInfo.firstName} ${updatedTaxData.personalInfo.lastName} (from: ${extractedTaxData.personalInfo.name})`);
                }
              }
              if (extractedTaxData.personalInfo.ssn && !updatedTaxData.personalInfo.ssn) {
                updatedTaxData.personalInfo.ssn = extractedTaxData.personalInfo.ssn;
                fieldsExtracted++;
                console.log(`✅ Extracted SSN from API: ${updatedTaxData.personalInfo.ssn}`);
              }
              if (extractedTaxData.personalInfo.address && !updatedTaxData.personalInfo.address) {
                // Try to use individual address components if available in the API response
                if (extractedTaxData.personalInfo.street) {
                  updatedTaxData.personalInfo.street = extractedTaxData.personalInfo.street;
                  fieldsExtracted++;
                }
                if (extractedTaxData.personalInfo.city) {
                  updatedTaxData.personalInfo.city = extractedTaxData.personalInfo.city;
                  fieldsExtracted++;
                }
                if (extractedTaxData.personalInfo.state) {
                  updatedTaxData.personalInfo.state = extractedTaxData.personalInfo.state;
                  fieldsExtracted++;
                }
                if (extractedTaxData.personalInfo.zip) {
                  updatedTaxData.personalInfo.zip = extractedTaxData.personalInfo.zip;
                  fieldsExtracted++;
                }
                
                // Set the full address
                updatedTaxData.personalInfo.address = extractedTaxData.personalInfo.address;
                
                // Only parse if individual components weren't available
                if (!extractedTaxData.personalInfo.street && !extractedTaxData.personalInfo.city && !extractedTaxData.personalInfo.state && !extractedTaxData.personalInfo.zip) {
                  const { street, city, state, zip } = parseAddressComponents(extractedTaxData.personalInfo.address);
                  if (street) updatedTaxData.personalInfo.street = street;
                  if (city) updatedTaxData.personalInfo.city = city;
                  if (state) updatedTaxData.personalInfo.state = state;
                  if (zip) updatedTaxData.personalInfo.zip = zip;
                  fieldsExtracted += street || city || state || zip ? 4 : 1;
                }
                
                console.log(`✅ Extracted address from API: ${extractedTaxData.personalInfo.address}`);
              }
            }

            // Store detailed breakdown information
            updatedTaxData.breakdown = extractedTaxData.breakdown;
            updatedTaxData.mathematicalBreakdown = mathematicalBreakdown;

            // Tax calculation
            if (taxCalculation) {
              updatedTaxData.taxCalculation = {
                taxableIncome: taxCalculation.taxableIncome,
                federalTax: taxCalculation.estimatedTax,
                refund: Math.max(0, (extractedTaxData.withholdings?.federalTax || 0) - taxCalculation.estimatedTax),
              };
              updatedTaxData.deductions.standard = taxCalculation.standardDeduction;
            }
            
            console.log(`💰 Income extracted - Wages: $${updatedTaxData.income.wages.toLocaleString()}, Interest: $${updatedTaxData.income.interest.toLocaleString()}, Dividends: $${updatedTaxData.income.dividends.toLocaleString()}`);
            console.log(`🎯 Success Rate: ${Math.round((mathematicalBreakdown.summary.documentsProcessed / mathematicalBreakdown.summary.totalDocumentsUploaded) * 100)}%`);
          }
        }
      } catch (apiError) {
        console.warn('⚠️ Comprehensive extraction failed, using direct document parsing:', apiError);
      }

      // Update state with extracted data
      setTaxData(updatedTaxData);
      setDataExtractionStatus('completed');
      
      console.log(`✅ Tax data extraction complete. ${fieldsExtracted} personal info fields auto-populated.`);
      console.log(`💼 Final extracted data:`, {
        personalInfo: updatedTaxData.personalInfo,
        income: updatedTaxData.income
      });
      
    } catch (error) {
      console.error('🚨 Tax Data Extraction Error:', error);
      setDataExtractionStatus('error');
      setError(error instanceof Error ? error.message : "Failed to process tax documents");
    } finally {
      setLoading(false);
    }
  };

  const parseAddressComponents = (fullAddress: string) => {
    const address = fullAddress.trim();
    
    // Extract ZIP code (5 or 9 digits at end)
    const zipMatch = address.match(/\b(\d{5}(?:-\d{4})?)\s*$/);
    const zip = zipMatch ? zipMatch[1] : '';
    
    // Extract state (2 letters before ZIP)
    const beforeZip = zip ? address.substring(0, address.lastIndexOf(zip)).trim() : address;
    const stateMatch = beforeZip.match(/\b([A-Z]{2})\s*,?\s*$/);
    const state = stateMatch ? stateMatch[1] : '';
    
    // Extract city (before state)
    const beforeState = state ? beforeZip.substring(0, beforeZip.lastIndexOf(state)).trim() : beforeZip;
    const cityMatch = beforeState.match(/,?\s*([^,]+?)\s*,?\s*$/);
    const city = cityMatch ? cityMatch[1].trim() : '';
    
    // Remaining is street
    const street = city ? beforeState.substring(0, beforeState.lastIndexOf(city)).replace(/,?\s*$/, '').trim() : beforeState;
    
    return { street, city, state, zip };
  };

  /**
   * Parse full name into first name and last name components
   * Handles common name formats:
   * - "John Doe" -> { firstName: "John", lastName: "Doe" }
   * - "Doe, John" -> { firstName: "John", lastName: "Doe" }
   * - "John Middle Doe" -> { firstName: "John", lastName: "Middle Doe" }
   * - "Doe, John Middle" -> { firstName: "John", lastName: "Doe Middle" }
   */
  const parseName = (fullName: string): { firstName: string; lastName: string } => {
    if (!fullName || typeof fullName !== 'string') {
      return { firstName: '', lastName: '' };
    }
    
    const trimmedName = fullName.trim();
    
    // Handle "LastName, FirstName" format
    if (trimmedName.includes(',')) {
      const parts = trimmedName.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        // parts[0] is last name, parts[1] is first name (and possibly middle name)
        const lastName = parts[0];
        const firstPart = parts[1];
        
        // If first part has multiple words, first word is first name, rest is middle name
        const firstPartWords = firstPart.split(/\s+/);
        if (firstPartWords.length > 1) {
          return {
            firstName: firstPartWords[0],
            lastName: `${lastName} ${firstPartWords.slice(1).join(' ')}`
          };
        }
        
        return {
          firstName: firstPart,
          lastName: lastName
        };
      }
    }
    
    // Handle "FirstName LastName" or "FirstName Middle LastName" format
    const words = trimmedName.split(/\s+/);
    if (words.length === 0) {
      return { firstName: '', lastName: '' };
    } else if (words.length === 1) {
      // Only one word - treat as first name
      return { firstName: words[0], lastName: '' };
    } else if (words.length === 2) {
      // Two words - first is first name, second is last name
      return { firstName: words[0], lastName: words[1] };
    } else {
      // Three or more words - first is first name, rest is last name (including middle names)
      return {
        firstName: words[0],
        lastName: words.slice(1).join(' ')
      };
    }
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateTaxData = (section: string, data: any) => {
    setTaxData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof TaxData],
        ...data,
      },
    }));
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const CurrentStepComponent = STEPS[currentStep].component;

  // Enhanced loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Processing Your Tax Documents</h3>
            <p className="text-muted-foreground">
              {dataExtractionStatus === 'extracting' 
                ? 'Extracting data from your uploaded tax documents...'
                : 'Loading your tax filing wizard...'
              }
            </p>
            {documents.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Processing {documents.length} document{documents.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Enhanced error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-6xl">⚠️</div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-red-700">Error Loading Tax Data</h3>
            <p className="text-red-600">{error}</p>
            <Button onClick={() => {
              setError(null);
              setDataExtractionStatus('idle');
              fetchDocuments();
            }} variant="outline" className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Card className="shadow-sm border-0 bg-white">
        <CardHeader className="pb-4">
          <div className="text-center space-y-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {STEPS[currentStep].title}
            </h1>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <span>Step {currentStep + 1} of {STEPS.length}</span>
              <span>•</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="w-full h-1" />
          </div>
        </CardHeader>
        <CardContent>
          <CurrentStepComponent
            taxData={taxData}
            documents={documents}
            updateTaxData={updateTaxData}
            onNext={nextStep}
            onPrev={prevStep}
          />
          
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            
            <Button
              onClick={nextStep}
              disabled={currentStep === STEPS.length - 1}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
