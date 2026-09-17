import { describe, it, expect, vi } from 'vitest'
import zlib from 'node:zlib'
import {
  DocumentParsingEngine,
  documentParsingEngine,
  type OcrProvider
} from '../../services/DocumentParsingEngine'

describe('DocumentParsingEngine (#477)', () => {
  const engine = new DocumentParsingEngine()

  /** Helper to generate a minimal valid PDF with a flate-compressed stream */
  function generateTestPdf(textContent: string): Buffer {
    const lines = textContent.split('\n')
    const streamBody = lines
      .map(
        (line) =>
          `(${line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj T*`
      )
      .join('\n')
    const compressedStream = zlib.deflateSync(Buffer.from(`BT /F1 12 Tf\n${streamBody}\nET`))
    const streamLength = compressedStream.length

    const pdfParts = [
      '%PDF-1.4\n',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n',
      `4 0 obj << /Length ${streamLength} /Filter /FlateDecode >>\nstream\n`,
      compressedStream,
      '\nendstream\nendobj\n',
      'xref\n0 5\n0000000000 65535 f \n',
      'trailer << /Root 1 0 R /Size 5 >>\nstartxref\n500\n%%EOF'
    ]

    return Buffer.concat(
      pdfParts.map((p) => (typeof p === 'string' ? Buffer.from(p, 'binary') : p))
    )
  }

  describe('PDF Stream Parsing', () => {
    it('extracts structured UCC-1 data from a compressed PDF stream', async () => {
      const pdfText = [
        'UCC FINANCING STATEMENT (UCC-1)',
        'INITIAL FINANCING STATEMENT FILE NO: 2024-88997711-0',
        'FILING DATE: 2024-03-15',
        "1a. ORGANIZATION'S NAME: ACME ROBOTICS LLC",
        '1c. MAILING ADDRESS: 100 TECH WAY, AUSTIN, TX 78701',
        "3a. ORGANIZATION'S NAME: APEX COMMERCIAL CAPITAL CORP",
        '3c. MAILING ADDRESS: 500 WALL STREET, NEW YORK, NY 10005',
        '4. This FINANCING STATEMENT covers the following collateral:',
        'All accounts, future receivables, inventory, equipment, and personal property now owned or hereafter acquired.'
      ].join('\n')

      const pdfBuffer = generateTestPdf(pdfText)
      const parsed = await engine.parsePdf(pdfBuffer, { fallbackState: 'TX' })

      expect(parsed.filingType).toBe('UCC-1')
      expect(parsed.filingNumber).toBe('2024-88997711-0')
      expect(parsed.filingDate).toBe('2024-03-15')
      expect(parsed.expirationDate).toBe('2029-03-15') // 5-year lapse
      expect(parsed.state).toBe('TX')

      expect(parsed.debtor.name).toBe('ACME ROBOTICS LLC')
      expect(parsed.debtor.isOrganization).toBe(true)
      expect(parsed.debtor.address?.state).toBe('TX')
      expect(parsed.debtor.address?.postalCode).toBe('78701')

      expect(parsed.securedParty.name).toBe('APEX COMMERCIAL CAPITAL CORP')
      expect(parsed.securedParty.isOrganization).toBe(true)

      expect(parsed.collateral.isAllAssets).toBe(true)
      expect(parsed.collateral.hasFutureReceivables).toBe(true)
      expect(parsed.collateral.hasEquipment).toBe(true)
      expect(parsed.collateral.hasInventory).toBe(true)
      expect(parsed.collateral.keywords).toContain('future-receivables')

      expect(parsed.confidence).toBeGreaterThanOrEqual(0.8)
      expect(parsed.extractionMethod).toBe('pdf-text')
    })

    it('extracts UCC-3 termination filings and links to initial filing number', async () => {
      const ucc3Text = [
        'UCC FINANCING STATEMENT AMENDMENT (FORM UCC-3)',
        'INITIAL FINANCING STATEMENT FILE NO: 2021-1234567-0',
        'FILE NUMBER: 2024-334455-0',
        'FILING DATE: 2024-06-20',
        'TERMINATION: Effectiveness of the Financing Statement identified above is terminated.',
        "1a. ORGANIZATION'S NAME: QUICK PAY LOGISTICS INC",
        "3a. ORGANIZATION'S NAME: FIRST METRO FUNDING LLC"
      ].join('\n')

      const pdfBuffer = generateTestPdf(ucc3Text)
      const parsed = await engine.parsePdf(pdfBuffer, { fallbackState: 'CA' })

      expect(parsed.filingType).toBe('UCC-3')
      expect(parsed.amendmentAction).toBe('termination')
      expect(parsed.initialFilingNumber).toBe('2021-1234567-0')
      expect(parsed.debtor.name).toBe('QUICK PAY LOGISTICS INC')
      expect(parsed.securedParty.name).toBe('FIRST METRO FUNDING LLC')
    })
  })

  describe('OCR Image Parsing', () => {
    it('uses registered OCR provider to extract data from scanned image', async () => {
      const mockOcrProvider: OcrProvider = {
        name: 'test-ocr',
        isAvailable: vi.fn().mockResolvedValue(true),
        recognize: vi.fn().mockResolvedValue(`
          UCC FINANCING STATEMENT UCC-1
          FILE NUMBER: 2025-99881122
          FILING DATE: 2025-01-10
          1a. ORGANIZATION'S NAME: DELTA MANUFACTURING CORP
          1c. MAILING ADDRESS: 200 INDUSTRIAL BLVD, COLUMBUS, OH 43215
          3a. ORGANIZATION'S NAME: CITIZENS BUSINESS BANK
          4. All inventory, accounts, and equipment now owned or hereafter acquired.
        `)
      }

      const customEngine = new DocumentParsingEngine()
      customEngine.registerOcrProvider(mockOcrProvider)

      const fakeImageBuffer = Buffer.from('fake-image-bytes')
      const parsed = await customEngine.parseImage(fakeImageBuffer, {
        ocrProviderName: 'test-ocr',
        fallbackState: 'OH'
      })

      expect(mockOcrProvider.recognize).toHaveBeenCalledWith(fakeImageBuffer)
      expect(parsed.filingNumber).toBe('2025-99881122')
      expect(parsed.debtor.name).toBe('DELTA MANUFACTURING CORP')
      expect(parsed.securedParty.name).toBe('CITIZENS BUSINESS BANK')
      expect(parsed.state).toBe('OH')
      expect(parsed.extractionMethod).toBe('ocr')
      expect(parsed.collateral.hasEquipment).toBe(true)
      expect(parsed.collateral.hasInventory).toBe(true)
    })
  })

  describe('Raw Text & Heuristic Extraction', () => {
    it('extracts individual debtors correctly', async () => {
      const rawText = `
        UCC FINANCING STATEMENT
        FILE NO: UCC-2024-554433
        FILING DATE: 2024-04-01
        1b. INDIVIDUAL'S SURNAME: SMITH FIRST PERSONAL NAME: ROBERT
        3a. ORGANIZATION'S NAME: LIBERTY EQUIPMENT FINANCE LLC
        4. Equipment described as 2022 Caterpillar Excavator Model 320.
      `

      const parsed = await engine.parseText(rawText, { fallbackState: 'IL' })

      expect(parsed.filingNumber).toBe('UCC-2024-554433')
      expect(parsed.debtor.name).toBe('Robert Smith')
      expect(parsed.debtor.isOrganization).toBe(false)
      expect(parsed.debtor.firstName).toBe('Robert')
      expect(parsed.debtor.lastName).toBe('Smith')
      expect(parsed.securedParty.name).toBe('LIBERTY EQUIPMENT FINANCE LLC')
      expect(parsed.collateral.hasEquipment).toBe(true)
      expect(parsed.collateral.isAllAssets).toBe(false)
    })

    it('identifies MCA future receivables financing signatures', async () => {
      const mcaFiling = `
        UCC-1 FINANCING STATEMENT
        FILE NUMBER: 2024-MCA-00123
        FILING DATE: 2024-08-15
        DEBTOR: SUNSHINE BISTRO LLC
        SECURED PARTY: ON-DECK CAPITAL INC
        COLLATERAL: All present and future receivables, sales proceeds, merchant cash advance payment rights, accounts, and contractual rights.
      `

      const parsed = await engine.parseText(mcaFiling, { fallbackState: 'FL' })

      expect(parsed.debtor.name).toBe('SUNSHINE BISTRO LLC')
      expect(parsed.securedParty.name).toBe('ON-DECK CAPITAL INC')
      expect(parsed.collateral.hasFutureReceivables).toBe(true)
      expect(parsed.collateral.keywords).toContain('future-receivables')
    })
  })

  describe('Canonical Schema Conversion', () => {
    it('converts parsed document into CollectedUCCFiling shape', async () => {
      const rawText = `
        UCC FINANCING STATEMENT
        FILE NUMBER: 2024-776655
        FILING DATE: 2024-05-10
        DEBTOR: FAST PACED DELIVERIES INC
        SECURED PARTY: JPMORGAN CHASE BANK
        COLLATERAL: All assets of the debtor.
      `

      const parsed = await engine.parseText(rawText, { fallbackState: 'NY' })
      const collected = engine.toCollectedFiling(parsed)

      expect(collected.filingNumber).toBe('2024-776655')
      expect(collected.filingType).toBe('UCC-1')
      expect(collected.filingDate).toBe('2024-05-10')
      expect(collected.status).toBe('active')
      expect(collected.debtor.name).toBe('FAST PACED DELIVERIES INC')
      expect(collected.securedParty.name).toBe('JPMORGAN CHASE BANK')
      expect(collected.collateral).toContain('All assets')
      expect(collected.rawData).toBeDefined()
    })

    it('converts parsed document into Core UCCFiling shape', async () => {
      const rawText = `
        UCC FINANCING STATEMENT AMENDMENT
        FILE NUMBER: 2024-990011
        FILING DATE: 2024-07-01
        TERMINATION
        DEBTOR: ALPHA TRUCKING LLC
        SECURED PARTY: CAPITAL ONE BANK
      `

      const parsed = await engine.parseText(rawText, { fallbackState: 'CA' })
      const core = engine.toCoreFiling(parsed)

      expect(core.id).toBe('CA:2024-990011')
      expect(core.filingType).toBe('UCC-3')
      expect(core.status).toBe('terminated')
      expect(core.debtorName).toBe('ALPHA TRUCKING LLC')
      expect(core.securedParty).toBe('CAPITAL ONE BANK')
    })
  })

  describe('Singleton instance', () => {
    it('exports documentParsingEngine ready for consumption', () => {
      expect(documentParsingEngine).toBeInstanceOf(DocumentParsingEngine)
    })
  })
})
