/**
 * Document Parsing Engine
 *
 * Integrates PDF stream extraction and OCR parsing to extract structured data
 * from raw UCC-1 (Financing Statement) and UCC-3 (Amendment) filings.
 *
 * Capabilities:
 * - PDF Byte Stream Extraction: Decodes PDF text streams, flate-compressed streams,
 *   text operators (Tj, TJ, ', ") and form layout markers.
 * - OCR Integration: Pluggable OCR interface for an explicitly registered provider.
 * - UCC Schema Normalization: Extracts filing number, filing date, lapse date,
 *   filing type/action, debtor organization/individual, secured party, and collateral details.
 * - Collateral Intelligence: Analyzes financing clauses (future receivables/MCA, all assets, equipment, inventory).
 * - Confidence & Data Quality Scoring: Evaluates field completeness and extraction certainty.
 *
 * @module server/services/DocumentParsingEngine
 */

import zlib from 'node:zlib'
import type { UCCFiling as CoreUCCFiling } from '@public-records/core'
import type {
  UCCFiling as CollectedUCCFiling,
  Party as CollectedParty
} from '../../apps/web/src/lib/collectors/types'

export interface ParsedAddress {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  raw?: string
}

export interface ParsedParty {
  name: string
  isOrganization: boolean
  firstName?: string
  lastName?: string
  middleName?: string
  address?: ParsedAddress
  organizationId?: string
  taxIdMasked?: string
}

export interface ParsedCollateral {
  description: string
  isAllAssets: boolean
  hasFutureReceivables: boolean
  hasEquipment: boolean
  hasInventory: boolean
  keywords: string[]
}

export type ParsedFilingType = 'UCC-1' | 'UCC-3' | 'UCC-5' | 'UNKNOWN'
export type ParsedAmendmentAction =
  'termination' | 'continuation' | 'assignment' | 'party_amendment' | 'collateral_change' | 'other'

export interface ParsedUCCDocument {
  filingNumber: string
  filingType: ParsedFilingType
  amendmentAction?: ParsedAmendmentAction
  initialFilingNumber?: string
  filingDate: string
  expirationDate?: string
  state: string
  debtor: ParsedParty
  additionalDebtors?: ParsedParty[]
  securedParty: ParsedParty
  assignee?: ParsedParty
  collateral: ParsedCollateral
  pages: number
  extractionMethod: 'pdf-text' | 'ocr' | 'hybrid' | 'raw-text'
  confidence: number
  warnings: string[]
  rawText: string
  extractedAt: string
}

export interface DocumentInput {
  content: Buffer | Uint8Array | string
  mimeType?: string
  filename?: string
  state?: string
  ocrProvider?: string
}

export interface ParsingOptions {
  fallbackState?: string
  minConfidence?: number
  enableOcr?: boolean
  ocrProviderName?: string
}

export interface OcrProvider {
  name: string
  isAvailable(): Promise<boolean>
  recognize(imageBuffer: Buffer, options?: { lang?: string }): Promise<string>
}

export class DocumentParsingEngine {
  private ocrProviders: Map<string, OcrProvider> = new Map()

  registerOcrProvider(provider: OcrProvider): void {
    this.ocrProviders.set(provider.name.toLowerCase(), provider)
  }

  getOcrProvider(name?: string): OcrProvider | undefined {
    if (name) {
      return this.ocrProviders.get(name.toLowerCase())
    }
    return this.ocrProviders.values().next().value
  }

  /**
   * Main entry point for document parsing.
   */
  async parseDocument(
    input: DocumentInput,
    options: ParsingOptions = {}
  ): Promise<ParsedUCCDocument> {
    const mime = (
      input.mimeType || this.detectMimeType(input.content, input.filename)
    ).toLowerCase()

    if (mime === 'application/pdf') {
      const buffer = this.toBuffer(input.content)
      return this.parsePdf(buffer, {
        ...options,
        fallbackState: input.state ?? options.fallbackState
      })
    }

    if (mime.startsWith('image/')) {
      const buffer = this.toBuffer(input.content)
      return this.parseImage(buffer, {
        ...options,
        fallbackState: input.state ?? options.fallbackState,
        ocrProviderName: input.ocrProvider ?? options.ocrProviderName
      })
    }

    // Default to raw text parsing
    const textContent =
      typeof input.content === 'string' ? input.content : input.content.toString('utf-8')
    return this.parseText(textContent, {
      ...options,
      fallbackState: input.state ?? options.fallbackState
    })
  }

  /**
   * Extract and parse text from PDF bytes.
   */
  async parsePdf(
    pdfBuffer: Buffer | Uint8Array,
    options: ParsingOptions = {}
  ): Promise<ParsedUCCDocument> {
    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer)
    const { text, pageCount, isScanned } = this.extractPdfText(buffer)

    if (isScanned && options.enableOcr !== false) {
      const ocrProvider = this.getOcrProvider(options.ocrProviderName)
      if (!ocrProvider || !(await ocrProvider.isAvailable())) {
        throw new Error(
          `No available OCR provider for scanned PDF (requested: ${options.ocrProviderName || 'default'})`
        )
      }
      const ocrText = await ocrProvider.recognize(buffer)
      const combined = `${text}\n${ocrText}`.trim()
      const parsed = this.parseExtractedText(combined, options, 'hybrid')
      parsed.pages = Math.max(pageCount, 1)
      return parsed
    }

    const parsed = this.parseExtractedText(text, options, 'pdf-text')
    parsed.pages = Math.max(pageCount, 1)
    return parsed
  }

  /**
   * Parse document from an image using OCR.
   */
  async parseImage(
    imageBuffer: Buffer | Uint8Array,
    options: ParsingOptions = {}
  ): Promise<ParsedUCCDocument> {
    const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer)
    const ocrProvider = this.getOcrProvider(options.ocrProviderName)

    if (!ocrProvider || !(await ocrProvider.isAvailable())) {
      throw new Error(
        `No available OCR provider for image parsing (requested: ${options.ocrProviderName || 'default'})`
      )
    }

    const ocrText = await ocrProvider.recognize(buffer)
    const parsed = this.parseExtractedText(ocrText, options, 'ocr')
    parsed.pages = 1
    return parsed
  }

  /**
   * Parse UCC fields from pre-extracted raw text.
   */
  parseText(rawText: string, options: ParsingOptions = {}): Promise<ParsedUCCDocument> {
    return Promise.resolve(this.parseExtractedText(rawText, options, 'raw-text'))
  }

  /**
   * Low-level PDF stream decoder.
   * Extracts text strings from PDF objects and flate-compressed streams.
   */
  private extractPdfText(buffer: Buffer): { text: string; pageCount: number; isScanned: boolean } {
    let pageCount = 0
    const textPieces: string[] = []

    const contentStr = buffer.toString('latin1')
    const pageMatches = contentStr.match(/\/Type\s*\/Page\b/g)
    if (pageMatches) {
      pageCount = pageMatches.length
    }

    // Binary search for streams
    const streamMarker = Buffer.from('stream')
    const endstreamMarker = Buffer.from('endstream')

    let streamStart = buffer.indexOf(streamMarker)
    while (streamStart !== -1) {
      let dataStart = streamStart + streamMarker.length
      if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) {
        dataStart += 2
      } else if (buffer[dataStart] === 0x0a || buffer[dataStart] === 0x0d) {
        dataStart += 1
      }

      const streamEnd = buffer.indexOf(endstreamMarker, dataStart)
      if (streamEnd === -1) break

      const streamBuffer = buffer.subarray(dataStart, streamEnd)
      const headerChunk = buffer
        .subarray(Math.max(0, streamStart - 300), streamStart)
        .toString('latin1')

      let streamText = ''
      if (/Filter\s*\/FlateDecode/i.test(headerChunk)) {
        try {
          const inflated = zlib.inflateSync(streamBuffer)
          streamText = inflated.toString('latin1')
        } catch {
          try {
            const rawInflated = zlib.inflateRawSync(streamBuffer)
            streamText = rawInflated.toString('latin1')
          } catch {
            streamText = streamBuffer.toString('latin1')
          }
        }
      } else {
        streamText = streamBuffer.toString('latin1')
      }

      const extracted = this.extractOperatorsText(streamText)
      if (extracted.trim()) {
        textPieces.push(extracted)
      }

      streamStart = buffer.indexOf(streamMarker, streamEnd + endstreamMarker.length)
    }

    if (textPieces.length === 0) {
      const direct = this.extractOperatorsText(contentStr)
      if (direct.trim()) textPieces.push(direct)
    }

    const fullText = textPieces.join('\n').trim()
    const isScanned = fullText.length < 50

    return {
      text: fullText,
      pageCount: pageCount || 1,
      isScanned
    }
  }

  /**
   * Extracts text from PDF text operators (Tj, TJ, ', ").
   */
  private extractOperatorsText(streamContent: string): string {
    const textBlocks: string[] = []

    // 1. TJ arrays: [ (text1) 120 (text2) ] TJ
    const tjArrayRegex = /\[(.*?)\]\s*TJ/gs
    let tjMatch: RegExpExecArray | null
    while ((tjMatch = tjArrayRegex.exec(streamContent)) !== null) {
      const arrayContent = tjMatch[1]
      const strMatches = arrayContent.match(/\((?:\\.|[^\\()]*)*\)/g)
      if (strMatches) {
        const joined = strMatches.map((s) => this.unescapePdfString(s.slice(1, -1))).join('')
        if (joined.trim()) textBlocks.push(joined.trim())
      }
    }

    // 2. Tj single string: (text) Tj or ' or "
    const tjSingleRegex = /\(((?:\\.|[^\\()])*)\)\s*(?:Tj|'|")/g
    let singleMatch: RegExpExecArray | null
    while ((singleMatch = tjSingleRegex.exec(streamContent)) !== null) {
      const text = this.unescapePdfString(singleMatch[1])
      if (text.trim()) textBlocks.push(text.trim())
    }

    return textBlocks.join('\n')
  }

  private unescapePdfString(str: string): string {
    return str
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
  }

  /**
   * Core parsing logic mapping extracted raw text to ParsedUCCDocument.
   */
  private parseExtractedText(
    rawText: string,
    options: ParsingOptions,
    method: ParsedUCCDocument['extractionMethod']
  ): ParsedUCCDocument {
    const warnings: string[] = []

    const filingType = this.extractFilingType(rawText)
    const amendmentAction =
      filingType === 'UCC-3' ? this.extractAmendmentAction(rawText) : undefined
    const filingNumber = this.extractFilingNumber(rawText, warnings)
    const initialFilingNumber =
      filingType === 'UCC-3' ? this.extractInitialFilingNumber(rawText) : undefined
    const filingDate = this.extractFilingDate(rawText, warnings)
    const expirationDate = this.extractExpirationDate(rawText, filingDate, filingType)
    const state = this.extractState(rawText, options.fallbackState)
    const debtor = this.extractDebtor(rawText, warnings)
    const additionalDebtors = this.extractAdditionalDebtors(rawText)
    const securedParty = this.extractSecuredParty(rawText, warnings)
    const collateral = this.extractCollateral(rawText)

    // Compute composite confidence
    const confidence = this.computeConfidence({
      filingNumber,
      filingDate,
      debtor,
      securedParty,
      collateral
    })

    if (confidence < (options.minConfidence ?? 0.5)) {
      warnings.push(`Overall extraction confidence (${confidence.toFixed(2)}) is below threshold`)
    }

    return {
      filingNumber,
      filingType,
      amendmentAction,
      initialFilingNumber,
      filingDate,
      expirationDate,
      state,
      debtor,
      additionalDebtors,
      securedParty,
      collateral,
      pages: 1,
      extractionMethod: method,
      confidence,
      warnings,
      rawText,
      extractedAt: new Date().toISOString()
    }
  }

  private extractFilingType(text: string): ParsedFilingType {
    if (/UCC-3|UCC3|FORM\s+UCC-3|FINANCING\s+STATEMENT\s+AMENDMENT/i.test(text)) {
      return 'UCC-3'
    }
    if (/UCC-5|UCC5|INFORMATION\s+STATEMENT/i.test(text)) {
      return 'UCC-5'
    }
    if (/UCC-1|UCC1|FINANCING\s+STATEMENT/i.test(text)) {
      return 'UCC-1'
    }
    return 'UNKNOWN'
  }

  private extractAmendmentAction(text: string): ParsedAmendmentAction {
    if (/TERMINATION|EFFECTIVENESS.*?TERMINATED/i.test(text)) return 'termination'
    if (/CONTINUATION|CONTINUED\s+FOR\s+ADDITIONAL\s+PERIOD/i.test(text)) return 'continuation'
    if (/ASSIGNMENT|NAME\s+AND\s+ADDRESS\s+OF\s+ASSIGNEE/i.test(text)) return 'assignment'
    if (/PARTY\s+AMENDMENT|CHANGE\s+NAME|DELETE\s+DEBTOR|ADD\s+DEBTOR/i.test(text))
      return 'party_amendment'
    if (/COLLATERAL\s+CHANGE|ADD\s+COLLATERAL|DELETE\s+COLLATERAL|RESTATE\s+COLLATERAL/i.test(text))
      return 'collateral_change'
    return 'other'
  }

  private extractFilingNumber(text: string, warnings: string[]): string {
    const patterns = [
      /(?:INITIAL\s+)?(?:FINANCING\s+STATEMENT\s+)?(?:FILE|FILING)\s*(?:NO|NUMBER|#)?[:.\s]*([A-Z0-9-]{6,30})/i,
      /(?:DOCUMENT|INSTRUMENT)\s*(?:NO|NUMBER|#)?[:.\s]*([A-Z0-9-]{6,30})/i,
      /\b(UCC-\d{4,16}(?:-[A-Z0-9]+)?)\b/i,
      /\b(\d{4}[-]\d{6,10}[-]?\d?)\b/,
      /\b(\d{2}[-]\d{6,10})\b/
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const cleaned = match[1].trim().replace(/[.,;:]$/, '')
        if (cleaned.length >= 6) {
          return cleaned
        }
      }
    }

    warnings.push('Filing number not found')
    return ''
  }

  private extractInitialFilingNumber(text: string): string | undefined {
    const pattern =
      /(?:INITIAL\s+FINANCING\s+STATEMENT\s+FILE\s*(?:NO|NUMBER|#)?[:.\s]*)([A-Z0-9-]{6,30})/i
    const match = text.match(pattern)
    return match ? match[1].trim() : undefined
  }

  private extractFilingDate(text: string, warnings: string[]): string {
    const patterns = [
      /(?:FILING|RECORDED|RECEIVED|FILE)\s*(?:DATE|DATE\/TIME)?[:.\s]*(\d{4}[-/.]\d{2}[-/.]\d{2})/i,
      /(?:FILING|RECORDED|RECEIVED|FILE)\s*(?:DATE|DATE\/TIME)?[:.\s]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
      /(?:FILING|RECORDED|RECEIVED|FILE)\s*(?:DATE|DATE\/TIME)?[:.\s]*([A-Za-z]{3,9}\s+\d{1,2},\s*\d{4})/i,
      /\b(\d{4}-\d{2}-\d{2})\b/
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const normalized = this.normalizeDate(match[1])
        if (normalized) return normalized
      }
    }

    warnings.push('Filing date not detected')
    return ''
  }

  private extractExpirationDate(
    text: string,
    filingDate: string,
    filingType: ParsedFilingType
  ): string | undefined {
    const match = text.match(
      /(?:LAPSE|EXPIRATION|EXPIRES)\s*(?:DATE)?[:.\s]*(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i
    )
    if (match && match[1]) {
      const normalized = this.normalizeDate(match[1])
      if (normalized) return normalized
    }

    // Standard UCC-1 lapses 5 years from filing date
    if (filingType === 'UCC-1' && filingDate) {
      const d = new Date(filingDate)
      if (!Number.isNaN(d.getTime())) {
        d.setFullYear(d.getFullYear() + 5)
        return d.toISOString().slice(0, 10)
      }
    }

    return undefined
  }

  private extractState(text: string, fallbackState?: string): string {
    const stateMatch = text.match(
      /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/
    )
    if (stateMatch) {
      return stateMatch[1].toUpperCase()
    }
    return (fallbackState || 'US').toUpperCase()
  }

  private toTitleCase(str: string): string {
    return str
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  private cleanPartyName(raw: string): string {
    return raw
      .replace(
        /^(?:NAME|ORGANIZATION|DEBTOR|SECURED PARTY|1[a-c]\.?|2[a-c]\.?|3[a-c]\.?|4\.)[:.\s-]*/i,
        ''
      )
      .replace(/\s+(?:1b|1c|2a|2b|3b|3c|4\.|MAILING|CITY|STATE|COLLATERAL)[\s:].*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/[.,;:]$/, '')
      .trim()
  }

  private extractDebtor(text: string, warnings: string[]): ParsedParty {
    // 1a. Organization Name
    const orgPatterns = [
      /(?:1a\.\s*ORGANIZATION(?:'S)?\s*NAME|DEBTOR(?:'S)?\s*(?:EXACT\s*)?(?:FULL\s*)?NAME|DEBTOR|BORROWER)[:.\s]*([^\n\r]+)/i
    ]

    for (const pattern of orgPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const name = this.cleanPartyName(match[1])
        if (name && name.length >= 2) {
          const address = this.extractAddress(text, 'debtor')
          return {
            name,
            isOrganization: true,
            address,
            organizationId: this.extractOrgId(text)
          }
        }
      }
    }

    // 1b. Individual Name
    const indMatch = text.match(
      /(?:1b\.\s*INDIVIDUAL(?:'S)?\s*SURNAME)[:.\s]*([A-Za-z'-]+)(?:.*?FIRST\s*(?:PERSONAL\s*)?NAME[:.\s]*([A-Za-z'-]+))?/i
    )
    if (indMatch && indMatch[1]) {
      const lastName = this.toTitleCase(indMatch[1].trim())
      const firstName = this.toTitleCase(indMatch[2]?.trim() || '')
      const fullName = `${firstName} ${lastName}`.trim()
      const address = this.extractAddress(text, 'debtor')
      return {
        name: fullName,
        isOrganization: false,
        firstName,
        lastName,
        address
      }
    }

    warnings.push('Debtor party not clearly detected')
    return {
      name: '',
      isOrganization: true
    }
  }

  private extractAdditionalDebtors(text: string): ParsedParty[] {
    const additional: ParsedParty[] = []
    const match = text.match(/(?:2a\.\s*ORGANIZATION(?:'S)?\s*NAME)[:.\s]*([^\n\r]+)/i)
    if (match && match[1]) {
      const name = this.cleanPartyName(match[1])
      if (name) {
        additional.push({ name, isOrganization: true })
      }
    }
    return additional
  }

  private extractSecuredParty(text: string, warnings: string[]): ParsedParty {
    const orgPatterns = [
      /(?:3a\.\s*ORGANIZATION(?:'S)?\s*NAME|SECURED\s*PARTY(?:'S)?\s*NAME|SECURED\s*PARTY|LENDER|CREDITOR)[:.\s]*([^\n\r]+)/i
    ]

    for (const pattern of orgPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const name = this.cleanPartyName(match[1])
        if (name && name.length >= 2) {
          const address = this.extractAddress(text, 'secured')
          return {
            name,
            isOrganization: true,
            address
          }
        }
      }
    }

    warnings.push('Secured party not clearly detected')
    return {
      name: '',
      isOrganization: true
    }
  }

  private extractAddress(text: string, partyRole: 'debtor' | 'secured'): ParsedAddress | undefined {
    const prefix = partyRole === 'debtor' ? '1c' : '3c'
    const addressPattern = new RegExp(
      `(?:${prefix}\\.\\s*MAILING\\s*ADDRESS|ADDRESS)[:.\\s]*([^\\n\\r]+)`,
      'i'
    )
    const match = text.match(addressPattern)
    if (match && match[1]) {
      const raw = match[1].trim()
      // Extract state and zip
      const stateZipMatch = text.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/)
      return {
        street: raw,
        state: stateZipMatch?.[1],
        postalCode: stateZipMatch?.[2],
        raw
      }
    }
    return undefined
  }

  private extractOrgId(text: string): string | undefined {
    const match = text.match(/(?:ORGANIZATIONAL\s*ID|ORG\s*ID)[:.\s]*([A-Z0-9-]+)/i)
    return match ? match[1].trim() : undefined
  }

  private extractCollateral(text: string): ParsedCollateral {
    const match = text.match(
      /(?:4\.\s*This\s*FINANCING\s*STATEMENT\s*covers|COLLATERAL(?:\s*DESCRIPTION)?[:.\s]*)([\s\S]*?)(?=(?:5\.|6\.|7\.|ALTERNATIVE\s+DESIGNATION|OPTIONAL\s+FILER|$))/i
    )
    const rawCollateral = match ? match[1].trim().replace(/\s{2,}/g, ' ') : ''

    const isAllAssets =
      /all\s+(?:assets|personal\s+property)|blanket\s+lien|now\s+owned\s+or\s+hereafter\s+acquired/i.test(
        rawCollateral || text
      )
    const hasFutureReceivables =
      /future\s+receivables|future\s+sales|sales\s+proceeds|merchant\s+cash\s+advance|card\s+receivables|electronic\s+payment\s+rights|factoring/i.test(
        rawCollateral || text
      )
    const hasEquipment = /equipment|machinery|vehicles|chattel/i.test(rawCollateral || text)
    const hasInventory = /inventory|goods|materials/i.test(rawCollateral || text)

    const keywords: string[] = []
    if (isAllAssets) keywords.push('all-assets')
    if (hasFutureReceivables) keywords.push('future-receivables')
    if (hasEquipment) keywords.push('equipment')
    if (hasInventory) keywords.push('inventory')

    return {
      description: rawCollateral,
      isAllAssets,
      hasFutureReceivables,
      hasEquipment,
      hasInventory,
      keywords
    }
  }

  private normalizeDate(dateStr: string): string | null {
    const d = new Date(dateStr)
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10)
    }
    return null
  }

  private computeConfidence(fields: {
    filingNumber: string
    filingDate: string
    debtor: ParsedParty
    securedParty: ParsedParty
    collateral: ParsedCollateral
  }): number {
    let score = 0.0

    if (fields.filingNumber) score += 0.25
    if (fields.filingDate) score += 0.15
    if (fields.debtor.name) {
      score += 0.25
      if (fields.debtor.address?.state) score += 0.05
    }
    if (fields.securedParty.name) {
      score += 0.2
    }
    if (fields.collateral && fields.collateral.description.length > 20) {
      score += 0.1
    }

    return Math.min(1.0, Number(score.toFixed(2)))
  }

  private detectMimeType(content: Buffer | Uint8Array | string, filename?: string): string {
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase()
      if (ext === 'pdf') return 'application/pdf'
      if (['png', 'jpg', 'jpeg', 'tiff', 'webp'].includes(ext || ''))
        return `image/${ext === 'jpg' ? 'jpeg' : ext}`
      if (ext === 'txt') return 'text/plain'
    }

    if (Buffer.isBuffer(content)) {
      if (content.subarray(0, 5).toString() === '%PDF-') {
        return 'application/pdf'
      }
      if (
        content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      ) {
        return 'image/png'
      }
      if (content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
        return 'image/jpeg'
      }
    }

    return 'text/plain'
  }

  private toBuffer(content: Buffer | Uint8Array | string): Buffer {
    if (Buffer.isBuffer(content)) return content
    if (content instanceof Uint8Array) return Buffer.from(content)
    // Try base64
    if (
      /^[A-Za-z0-9+/=]+$/.test(content.trim()) &&
      content.length % 4 === 0 &&
      content.length > 64
    ) {
      try {
        return Buffer.from(content, 'base64')
      } catch {
        // Fall back to utf-8 buffer
      }
    }
    return Buffer.from(content, 'utf-8')
  }

  /**
   * Convert parsed document to CollectedUCCFiling format for ingestion pipeline.
   */
  toCollectedFiling(parsed: ParsedUCCDocument): CollectedUCCFiling {
    this.assertCanonicalFields(parsed)
    const debtorParty: CollectedParty = {
      name: parsed.debtor.name,
      address: this.toCollectedAddress(parsed.debtor.address),
      organizationType: parsed.debtor.isOrganization ? 'organization' : 'individual'
    }

    const securedParty: CollectedParty = {
      name: parsed.securedParty.name,
      address: this.toCollectedAddress(parsed.securedParty.address),
      organizationType: parsed.securedParty.isOrganization ? 'organization' : 'individual'
    }

    return {
      filingNumber: parsed.filingNumber,
      filingType: parsed.filingType,
      filingDate: parsed.filingDate,
      expirationDate: parsed.expirationDate,
      status: parsed.amendmentAction === 'termination' ? 'terminated' : 'active',
      state: parsed.state,
      debtor: debtorParty,
      securedParty,
      collateral: parsed.collateral.description,
      pages: parsed.pages,
      rawData: {
        parsedAt: parsed.extractedAt,
        confidence: parsed.confidence,
        extractionMethod: parsed.extractionMethod,
        keywords: parsed.collateral.keywords,
        warnings: parsed.warnings
      }
    }
  }

  /**
   * Convert parsed document to CoreUCCFiling format.
   */
  toCoreFiling(parsed: ParsedUCCDocument, id?: string): CoreUCCFiling {
    this.assertCanonicalFields(parsed)
    if (parsed.filingType !== 'UCC-1' && parsed.filingType !== 'UCC-3') {
      throw new Error('Cannot canonicalize a document with an unknown filing type')
    }
    return {
      id: id || `${parsed.state}:${parsed.filingNumber}`,
      filingDate: parsed.filingDate,
      debtorName: parsed.debtor.name,
      securedParty: parsed.securedParty.name,
      state: parsed.state,
      status: parsed.amendmentAction === 'termination' ? 'terminated' : 'active',
      filingType: parsed.filingType
    }
  }

  private assertCanonicalFields(parsed: ParsedUCCDocument): void {
    const missing = [
      ['filingNumber', parsed.filingNumber],
      ['filingDate', parsed.filingDate],
      ['debtor.name', parsed.debtor.name],
      ['securedParty.name', parsed.securedParty.name]
    ].filter(([, value]) => !value)
    if (missing.length > 0) {
      throw new Error(
        `Cannot canonicalize incomplete extraction; missing: ${missing.map(([field]) => field).join(', ')}`
      )
    }
  }

  private toCollectedAddress(address?: ParsedAddress): CollectedParty['address'] {
    if (!address) return undefined
    return {
      street: address.street ?? address.raw,
      city: address.city,
      state: address.state,
      zipCode: address.postalCode,
      country: address.country
    }
  }
}

export const documentParsingEngine = new DocumentParsingEngine()
