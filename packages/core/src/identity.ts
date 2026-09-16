const COMPANY_SUFFIXES = [
  'incorporated',
  'inc',
  'corp',
  'corporation',
  'llc',
  'l.l.c',
  'ltd',
  'limited',
  'lp',
  'l.p',
  'llp',
  'l.l.p',
  'pllc',
  'co',
  'company',
  'pc',
  'p.c',
  'pa',
  'p.a',
  'dba',
  'holdings',
  'holding',
  'group',
  'enterprises',
  'enterprise'
]

const PERSON_SUFFIXES = new Set([
  'jr',
  'jr.',
  'sr',
  'sr.',
  'ii',
  'iii',
  'iv',
  'v',
  'esq',
  'esq.',
  'md',
  'm.d.',
  'phd',
  'ph.d.'
])

/**
 * Common nickname to formal first name mappings for entity resolution.
 */
export const NICKNAME_MAP: Record<string, string> = {
  bob: 'robert',
  bobby: 'robert',
  rob: 'robert',
  robbie: 'robert',
  bill: 'william',
  billy: 'william',
  will: 'william',
  willie: 'william',
  liam: 'william',
  dick: 'richard',
  rick: 'richard',
  rich: 'richard',
  ricky: 'richard',
  jim: 'james',
  jimmy: 'james',
  jamie: 'james',
  mike: 'michael',
  mikey: 'michael',
  dave: 'david',
  davey: 'david',
  dan: 'daniel',
  danny: 'daniel',
  tom: 'thomas',
  tommy: 'thomas',
  chris: 'christopher',
  alex: 'alexander',
  matt: 'matthew',
  matty: 'matthew',
  steve: 'stephen',
  steven: 'stephen',
  tony: 'anthony',
  ed: 'edward',
  eddie: 'edward',
  ned: 'edward',
  ted: 'theodore',
  teddy: 'theodore',
  joe: 'joseph',
  joey: 'joseph',
  ken: 'kenneth',
  kenny: 'kenneth',
  sam: 'samuel',
  sammy: 'samuel',
  ben: 'benjamin',
  benny: 'benjamin',
  jon: 'jonathan',
  johnny: 'john',
  jack: 'john',
  chuck: 'charles',
  charlie: 'charles',
  andy: 'andrew',
  drew: 'andrew',
  greg: 'gregory',
  ron: 'ronald',
  ronny: 'ronald',
  don: 'donald',
  donny: 'donald',
  larry: 'lawrence',
  gene: 'eugene',
  jerry: 'gerald',
  gary: 'garrett',
  beth: 'elizabeth',
  liz: 'elizabeth',
  lizzie: 'elizabeth',
  kate: 'katherine',
  katie: 'katherine',
  kathy: 'katherine',
  maggie: 'margaret',
  peggy: 'margaret',
  sue: 'susan',
  susie: 'susan',
  jen: 'jennifer',
  jenny: 'jennifer',
  becky: 'rebecca',
  pat: 'patricia',
  patty: 'patricia'
}

/**
 * Normalizes a company name by lowercasing, expanding ampersands, stripping punctuation
 * and corporate entity suffixes.
 */
export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !COMPANY_SUFFIXES.includes(token))
    .join(' ')
}

/**
 * Normalizes a person's first name by checking nickname aliases.
 */
export function canonicalizeFirstName(firstName: string): string {
  const clean = firstName
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
  return NICKNAME_MAP[clean] || clean
}

export interface ParsedPersonName {
  fullName: string
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  canonicalFirstName: string
}

/**
 * Parses and normalizes an individual's name into structured components.
 * Handles both "First Middle Last Suffix" and "Last, First Middle Suffix" formats.
 */
export function normalizePersonName(rawName: string): ParsedPersonName {
  const clean = rawName.trim().replace(/\s+/g, ' ')
  let firstName = ''
  let middleName: string | undefined
  let lastName = ''
  let suffix: string | undefined

  if (clean.includes(',')) {
    // "Smith, John M. Jr." or "Smith, John M."
    const [lastPart, firstPart] = clean.split(',', 2).map((s) => s.trim())
    lastName = lastPart.toLowerCase().replace(/[^a-z'-]/g, '')

    const firstTokens = firstPart.split(/\s+/).filter(Boolean)
    if (firstTokens.length > 0) {
      // Check if last token is suffix
      const potentialSuffix = firstTokens[firstTokens.length - 1].toLowerCase()
      if (PERSON_SUFFIXES.has(potentialSuffix)) {
        suffix = potentialSuffix.replace(/\./g, '')
        firstTokens.pop()
      }

      if (firstTokens.length > 0) {
        firstName = firstTokens[0].toLowerCase().replace(/[^a-z'-]/g, '')
        if (firstTokens.length > 1) {
          middleName = firstTokens
            .slice(1)
            .join(' ')
            .toLowerCase()
            .replace(/[^a-z'-]/g, '')
        }
      }
    }
  } else {
    // "John M. Smith Jr." or "John Smith"
    const tokens = clean.split(/\s+/).filter(Boolean)
    if (tokens.length > 0) {
      const potentialSuffix = tokens[tokens.length - 1].toLowerCase()
      if (PERSON_SUFFIXES.has(potentialSuffix)) {
        suffix = potentialSuffix.replace(/\./g, '')
        tokens.pop()
      }

      if (tokens.length === 1) {
        lastName = tokens[0].toLowerCase().replace(/[^a-z'-]/g, '')
      } else if (tokens.length === 2) {
        firstName = tokens[0].toLowerCase().replace(/[^a-z'-]/g, '')
        lastName = tokens[1].toLowerCase().replace(/[^a-z'-]/g, '')
      } else {
        firstName = tokens[0].toLowerCase().replace(/[^a-z'-]/g, '')
        lastName = tokens[tokens.length - 1].toLowerCase().replace(/[^a-z'-]/g, '')
        middleName = tokens
          .slice(1, -1)
          .join(' ')
          .toLowerCase()
          .replace(/[^a-z'-]/g, '')
      }
    }
  }

  const canonicalFirst = canonicalizeFirstName(firstName)
  const normalizedFull = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ')

  return {
    fullName: normalizedFull,
    firstName,
    middleName,
    lastName,
    suffix,
    canonicalFirstName: canonicalFirst
  }
}

/**
 * Standard Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const row = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) {
    row[j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = temp
    }
  }

  return row[b.length]
}

/**
 * Normalized Levenshtein similarity score in [0, 1].
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1.0
  const dist = levenshteinDistance(a, b)
  return Math.max(0, 1 - dist / maxLen)
}

/**
 * Jaro-Winkler string similarity in [0, 1].
 * Favors matching prefixes, highly effective for proper names and corporate identifiers.
 */
export function jaroWinklerSimilarity(s1: string, s2: string, prefixScale = 0.1): number {
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1
  const s1Matches = new Array(s1.length).fill(false)
  const s2Matches = new Array(s2.length).fill(false)

  let matches = 0
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, s2.length)

    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue
      if (s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  let transpositions = 0
  let k = 0
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3.0

  // Winkler prefix adjustment
  let prefix = 0
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length))
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }

  return jaro + prefix * prefixScale * (1 - jaro)
}

/**
 * Token Jaccard similarity in [0, 1] between whitespace-separated tokens.
 */
export function tokenJaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))

  if (setA.size === 0 && setB.size === 0) return 1.0
  if (setA.size === 0 || setB.size === 0) return 0.0

  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return intersection / union
}

/**
 * Token containment score in [0, 1].
 * Computes |A ∩ B| / min(|A|, |B|).
 * Crucial for cases where one entity has an added qualifier or expansion.
 */
export function tokenContainmentScore(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))

  const minSize = Math.min(setA.size, setB.size)
  if (minSize === 0) return 0.0

  let intersection = 0
  for (const item of setA) {
    if (setB.has(item)) intersection++
  }

  return intersection / minSize
}

/**
 * American Soundex phonetic code (4 characters: Letter + 3 digits).
 * Maps phonetically similar surnames / names to the same code.
 */
export function soundex(str: string): string {
  const clean = str.toUpperCase().replace(/[^A-Z]/g, '')
  if (!clean) return '0000'

  const mapping: Record<string, string> = {
    B: '1',
    F: '1',
    P: '1',
    V: '1',
    C: '2',
    G: '2',
    J: '2',
    K: '2',
    Q: '2',
    S: '2',
    X: '2',
    Z: '2',
    D: '3',
    T: '3',
    L: '4',
    M: '5',
    N: '5',
    R: '6'
  }

  const firstChar = clean[0]
  let result = firstChar
  let prevCode = mapping[firstChar] || '0'

  for (let i = 1; i < clean.length && result.length < 4; i++) {
    const char = clean[i]
    const code = mapping[char]

    if (code) {
      if (code !== prevCode) {
        result += code
      }
      prevCode = code
    } else if (char === 'H' || char === 'W') {
      // H and W are ignored completely, prevCode retained
    } else {
      // Vowels (A, E, I, O, U, Y) reset previous code
      prevCode = '0'
    }
  }

  return result.padEnd(4, '0')
}
