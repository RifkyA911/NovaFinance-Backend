import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey =
  process.env.GOOGLE_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  '';

const genAI = new GoogleGenerativeAI(apiKey);

export interface DocumentMetadata {
  documentType?: 'receipt' | 'invoice' | 'contract' | 'statement' | 'other';
  amount?: number;
  currency?: string;
  date?: string;
  vendor?: string;
  merchant?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
  }>;
  categories?: string[];
  extractedText?: string;
  entities?: Array<{
    type: string;
    value: string;
    confidence?: number;
  }>;
  confidence?: number;
}

export async function analyzeDocument(
  fileBuffer: Buffer,
  mimeType: string
): Promise<DocumentMetadata> {
  try {
    // Use Gemini 3.6 Flash for high-accuracy vision analysis
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const prompt = `Analyze this receipt or invoice image carefully and extract financial transaction metadata in strict JSON format:
{
  "documentType": "receipt" | "invoice" | "other",
  "amount": number,
  "currency": "IDR" | "USD" | "EUR" | string,
  "date": "YYYY-MM-DD",
  "vendor": "Official company/business name",
  "merchant": "Store brand or merchant name",
  "lineItems": [
    {
      "description": "Item or service name",
      "quantity": 1,
      "unitPrice": 10000,
      "totalPrice": 10000
    }
  ],
  "categories": ["Category name e.g. Food & Dining, Groceries, Utilities, Transport, Shopping"],
  "extractedText": "Summary text or main text extracted from receipt",
  "confidence": 0.95
}

Important Instructions:
1. For amount: return a pure numeric number without currency symbols, commas or dots (e.g. 150000 not "Rp 150.000").
2. For date: format as YYYY-MM-DD. If year is missing, assume current year.
3. For merchant/vendor: prioritize clearly identifiable store names (e.g. Indomaret, Alfamart, Starbucks, PLN, Tokopedia, etc.).
4. Return ONLY a valid JSON object.`;

    const imagePart = {
      inlineData: {
        data: fileBuffer.toString('base64'),
        mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Clean JSON response (strip markdown wrappers if present)
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Gemini response as JSON');
    }

    const metadata: DocumentMetadata = JSON.parse(jsonMatch[0]);

    // Normalize amount to ensure it is a numeric float
    if (typeof metadata.amount === 'string') {
      const parsedAmount = parseFloat(String(metadata.amount).replace(/[^0-9.-]+/g, ''));
      metadata.amount = isNaN(parsedAmount) ? undefined : parsedAmount;
    }

    return metadata;
  } catch (error) {
    console.error('Gemini analysis error:', error);
    throw new Error(`Failed to analyze document with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function analyzePDFDocument(
  _fileBuffer: Buffer
): Promise<DocumentMetadata> {
  try {
    // For PDFs, we might need to extract text first using a PDF library
    // For now, return basic metadata
    return {
      documentType: 'other',
      extractedText: 'PDF text extraction not yet implemented',
      confidence: 0,
    };
  } catch (error) {
    console.error('PDF analysis error:', error);
    throw new Error(`Failed to analyze PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
