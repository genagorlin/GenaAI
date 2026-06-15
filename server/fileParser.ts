import { ObjectStorageService } from "./objectStorage";

async function getPdfParser() {
  const pdfParse = await import("pdf-parse");
  return (pdfParse as any).default || pdfParse;
}

async function getMammoth() {
  const mammoth = await import("mammoth");
  return (mammoth as any).default || mammoth;
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
      return await parseDocx(buffer, mimeType, filename);
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

async function parseDocx(buffer: Buffer, mimeType: string, filename: string): Promise<ParsedFile> {
  try {
    const mammoth = await getMammoth();
    // extractRawText gives clean plain text with paragraph breaks preserved,
    // which is what we want for both prompt context and verbatim excerpting.
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || "").trim();
    if (result.messages && result.messages.length > 0) {
      console.log(`[FileParser] mammoth messages for ${filename}: ${result.messages.length} (e.g. ${result.messages[0]?.message})`);
    }
    if (!text) {
      return {
        text: `[Word document ${filename} appears to be empty or could not be extracted.]`,
        mimeType,
        filename,
      };
    }
    return { text, mimeType, filename };
  } catch (error) {
    console.error(`[FileParser] DOCX parse error for ${filename}:`, error);
    return {
      text: `[Error parsing Word document: ${filename}]`,
      mimeType,
      filename,
    };
  }
}

/**
 * Extract a .docx as Markdown, preserving heading structure (# / ## / ...).
 * Used by the wiki ingestion pipeline to chunk a book along chapter/section
 * boundaries rather than blind token windows.
 */
export async function parseDocxToMarkdown(buffer: Buffer): Promise<string> {
  const mammoth = await getMammoth();
  const result = await mammoth.convertToMarkdown({ buffer });
  return (result.value || "").trim();
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
