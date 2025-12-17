import { ObjectStorageService } from "./objectStorage";

async function getPdfParser() {
  const pdfParse = await import("pdf-parse");
  return (pdfParse as any).default || pdfParse;
}

export interface ParsedFile {
  text: string;
  pageCount?: number;
  mimeType: string;
  filename: string;
}

const objectStorageService = new ObjectStorageService();

export async function parseFileFromStorage(objectPath: string, mimeType: string, filename: string): Promise<ParsedFile> {
  try {
    const buffer = await objectStorageService.getFileContent(objectPath);
    return parseFileBuffer(buffer, mimeType, filename);
  } catch (error) {
    console.error(`[FileParser] Error fetching file from storage: ${objectPath}`, error);
    return {
      text: `[Unable to read file: ${filename}]`,
      mimeType,
      filename,
    };
  }
}

export async function parseFileBuffer(buffer: Buffer, mimeType: string, filename: string): Promise<ParsedFile> {
  try {
    if (mimeType === "application/pdf") {
      return await parsePdf(buffer, filename);
    }

    if (mimeType.startsWith("text/") || 
        mimeType === "application/json" ||
        mimeType === "application/xml" ||
        mimeType === "text/plain" ||
        mimeType === "text/markdown") {
      return parseTextFile(buffer, mimeType, filename);
    }

    if (mimeType.startsWith("image/")) {
      return {
        text: `[Image file: ${filename} - Content cannot be extracted as text. For image analysis, consider using vision-capable AI models.]`,
        mimeType,
        filename,
      };
    }

    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimeType === "application/msword") {
      return {
        text: `[Word document: ${filename} - For full extraction, please convert to PDF or paste the text content directly.]`,
        mimeType,
        filename,
      };
    }

    return {
      text: `[Unsupported file type: ${mimeType}. File: ${filename}]`,
      mimeType,
      filename,
    };
  } catch (error) {
    console.error(`[FileParser] Error parsing file ${filename}:`, error);
    return {
      text: `[Error parsing file: ${filename}]`,
      mimeType,
      filename,
    };
  }
}

async function parsePdf(buffer: Buffer, filename: string): Promise<ParsedFile> {
  try {
    const pdf = await getPdfParser();
    const data = await pdf(buffer);
    return {
      text: data.text.trim(),
      pageCount: data.numpages,
      mimeType: "application/pdf",
      filename,
    };
  } catch (error) {
    console.error(`[FileParser] PDF parse error for ${filename}:`, error);
    return {
      text: `[Error parsing PDF: ${filename}]`,
      mimeType: "application/pdf",
      filename,
    };
  }
}

function parseTextFile(buffer: Buffer, mimeType: string, filename: string): ParsedFile {
  const text = buffer.toString("utf-8").trim();
  return {
    text,
    mimeType,
    filename,
  };
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "... [truncated]";
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
