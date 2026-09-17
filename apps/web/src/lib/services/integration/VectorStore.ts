/**
 * Vector Store Service - Enables semantic search and similarity matching
 * Provides in-memory vector database for prospect and content search
 */

export interface VectorDocument {
  id: string
  text: string
  embedding: number[]
  metadata: Record<string, unknown>
  timestamp: Date
}

export interface SearchResult {
  document: VectorDocument
  similarity: number
  rank: number
}

export interface VectorIndex {
  documents: Map<string, VectorDocument>
  dimensionality: number
  totalDocuments: number
  createdAt: Date
  lastUpdated: Date
}

class VectorStore {
  private indices: Map<string, VectorIndex> = new Map()
  private generateEmbedding: (text: string) => Promise<number[]>

  constructor(embeddingFunction: (text: string) => Promise<number[]>) {
    this.generateEmbedding = embeddingFunction
  }

  /**
   * Create a new vector index
   */
  async createIndex(indexName: string): Promise<void> {
    if (this.indices.has(indexName)) {
      throw new Error(`Index ${indexName} already exists`)
    }

    this.indices.set(indexName, {
      documents: new Map(),
      dimensionality: 0,
      totalDocuments: 0,
      createdAt: new Date(),
      lastUpdated: new Date()
    })
  }

  /**
   * Add document to index
   */
  async addDocument(
    indexName: string,
    id: string,
    text: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const index = this.getIndex(indexName)
    const embedding = await this.generateEmbedding(text)

    // Set dimensionality on first document
    if (index.totalDocuments === 0) {
      index.dimensionality = embedding.length
    } else if (embedding.length !== index.dimensionality) {
      throw new Error(
        `Embedding dimension mismatch: expected ${index.dimensionality}, got ${embedding.length}`
      )
    }

    const document: VectorDocument = {
      id,
      text,
      embedding,
      metadata,
      timestamp: new Date()
    }

    index.documents.set(id, document)
    index.totalDocuments = index.documents.size
    index.lastUpdated = new Date()
  }

  /**
   * Add multiple documents in batch
   */
  async addDocuments(
    indexName: string,
    documents: Array<{ id: string; text: string; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    for (const doc of documents) {
      await this.addDocument(indexName, doc.id, doc.text, doc.metadata || {})
    }
  }

  /**
   * Search for similar documents
   */
  async search(
    indexName: string,
    query: string,
    limit: number = 10,
    filter?: (metadata: Record<string, unknown>) => boolean
  ): Promise<SearchResult[]> {
    const index = this.getIndex(indexName)
    const queryEmbedding = await this.generateEmbedding(query)

    // Calculate similarities
    const results: Array<{ document: VectorDocument; similarity: number }> = []

    for (const document of index.documents.values()) {
      // Apply filter if provided
      if (filter && !filter(document.metadata)) {
        continue
      }

      const similarity = this.cosineSimilarity(queryEmbedding, document.embedding)
      results.push({ document, similarity })
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity)
    const topResults = results.slice(0, limit)

    // Add rank
    return topResults.map((result, index) => ({
      ...result,
      rank: index + 1
    }))
  }

  /**
   * Find similar documents to a given document
   */
  async findSimilar(
    indexName: string,
    documentId: string,
    limit: number = 10,
    excludeSelf: boolean = true
  ): Promise<SearchResult[]> {
    const index = this.getIndex(indexName)
    const sourceDocument = index.documents.get(documentId)

    if (!sourceDocument) {
      throw new Error(`Document ${documentId} not found in index ${indexName}`)
    }

    const results: Array<{ document: VectorDocument; similarity: number }> = []

    for (const document of index.documents.values()) {
      // Skip self if requested
      if (excludeSelf && document.id === documentId) {
        continue
      }

      const similarity = this.cosineSimilarity(sourceDocument.embedding, document.embedding)
      results.push({ document, similarity })
    }

    // Sort and limit
    results.sort((a, b) => b.similarity - a.similarity)
    const topResults = results.slice(0, limit)

    return topResults.map((result, index) => ({
      ...result,
      rank: index + 1
    }))
  }

  /**
   * Get document by ID
   */
  getDocument(indexName: string, documentId: string): VectorDocument | undefined {
    const index = this.indices.get(indexName)
    return index?.documents.get(documentId)
  }

  /**
   * Update document
   */
  async updateDocument(
    indexName: string,
    documentId: string,
    text?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const index = this.getIndex(indexName)
    const existing = index.documents.get(documentId)

    if (!existing) {
      throw new Error(`Document ${documentId} not found in index ${indexName}`)
    }

    const updatedText = text ?? existing.text
    const updatedMetadata = metadata ?? existing.metadata

    // Regenerate embedding if text changed
    const embedding = text ? await this.generateEmbedding(updatedText) : existing.embedding

    const updated: VectorDocument = {
      id: documentId,
      text: updatedText,
      embedding,
      metadata: updatedMetadata,
      timestamp: new Date()
    }

    index.documents.set(documentId, updated)
    index.lastUpdated = new Date()
  }

  /**
   * Delete document
   */
  deleteDocument(indexName: string, documentId: string): boolean {
    const index = this.getIndex(indexName)
    const deleted = index.documents.delete(documentId)

    if (deleted) {
      index.totalDocuments = index.documents.size
      index.lastUpdated = new Date()
    }

    return deleted
  }

  /**
   * Delete index
   */
  deleteIndex(indexName: string): boolean {
    return this.indices.delete(indexName)
  }

  /**
   * Get index statistics
   */
  getIndexStats(indexName: string) {
    const index = this.getIndex(indexName)

    return {
      name: indexName,
      totalDocuments: index.totalDocuments,
      dimensionality: index.dimensionality,
      createdAt: index.createdAt,
      lastUpdated: index.lastUpdated,
      sizeInMemory: this.estimateIndexSize(index)
    }
  }

  /**
   * List all indices
   */
  listIndices(): string[] {
    return Array.from(this.indices.keys())
  }

  /**
   * Clear all documents from index
   */
  clearIndex(indexName: string): void {
    const index = this.getIndex(indexName)
    index.documents.clear()
    index.totalDocuments = 0
    index.lastUpdated = new Date()
  }

  /**
   * Cluster documents using k-means
   */
  async clusterDocuments(
    indexName: string,
    numClusters: number
  ): Promise<Array<{ centroid: number[]; documentIds: string[] }>> {
    const index = this.getIndex(indexName)
    const documents = Array.from(index.documents.values())

    if (documents.length < numClusters) {
      throw new Error('Number of clusters cannot exceed number of documents')
    }

    // Initialize centroids randomly
    const centroids: number[][] = []
    const shuffled = [...documents].sort(() => Math.random() - 0.5)
    for (let i = 0; i < numClusters; i++) {
      centroids.push([...shuffled[i].embedding])
    }

    // K-means iterations
    const maxIterations = 100
    for (let iter = 0; iter < maxIterations; iter++) {
      // Assign documents to nearest centroid
      const clusters: Map<number, string[]> = new Map()
      for (let i = 0; i < numClusters; i++) {
        clusters.set(i, [])
      }

      for (const doc of documents) {
        let bestCluster = 0
        let bestSimilarity = -1

        for (let i = 0; i < numClusters; i++) {
          const similarity = this.cosineSimilarity(doc.embedding, centroids[i])
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity
            bestCluster = i
          }
        }

        clusters.get(bestCluster)!.push(doc.id)
      }

      // Update centroids
      let changed = false
      for (let i = 0; i < numClusters; i++) {
        const clusterDocs = clusters.get(i)!
        if (clusterDocs.length === 0) continue

        const newCentroid = this.calculateMean(
          clusterDocs.map((id) => index.documents.get(id)!.embedding)
        )

        if (!this.arraysEqual(centroids[i], newCentroid)) {
          centroids[i] = newCentroid
          changed = true
        }
      }

      if (!changed) break // Converged
    }

    // Final assignment
    const finalClusters: Map<number, string[]> = new Map()
    for (let i = 0; i < numClusters; i++) {
      finalClusters.set(i, [])
    }

    for (const doc of documents) {
      let bestCluster = 0
      let bestSimilarity = -1

      for (let i = 0; i < numClusters; i++) {
        const similarity = this.cosineSimilarity(doc.embedding, centroids[i])
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          bestCluster = i
        }
      }

      finalClusters.get(bestCluster)!.push(doc.id)
    }

    return Array.from(finalClusters.entries()).map(([_, documentIds]) => ({
      centroid: centroids[_],
      documentIds
    }))
  }

  // ==================== PRIVATE METHODS ====================

  private getIndex(indexName: string): VectorIndex {
    const index = this.indices.get(indexName)
    if (!index) {
      throw new Error(`Index ${indexName} not found`)
    }
    return index
  }

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same dimensionality')
    }

    let dotProduct = 0
    let mag1 = 0
    let mag2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      mag1 += vec1[i] * vec1[i]
      mag2 += vec2[i] * vec2[i]
    }

    mag1 = Math.sqrt(mag1)
    mag2 = Math.sqrt(mag2)

    if (mag1 === 0 || mag2 === 0) return 0

    return dotProduct / (mag1 * mag2)
  }

  private calculateMean(vectors: number[][]): number[] {
    if (vectors.length === 0) {
      throw new Error('Cannot calculate mean of empty vector set')
    }

    const dimensionality = vectors[0].length
    const mean = new Array(dimensionality).fill(0)

    for (const vec of vectors) {
      for (let i = 0; i < dimensionality; i++) {
        mean[i] += vec[i]
      }
    }

    for (let i = 0; i < dimensionality; i++) {
      mean[i] /= vectors.length
    }

    return mean
  }

  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    const epsilon = 0.0001
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > epsilon) return false
    }
    return true
  }

  private estimateIndexSize(index: VectorIndex): number {
    // Rough estimate in bytes
    let size = 0

    for (const doc of index.documents.values()) {
      size += doc.text.length * 2 // UTF-16 chars
      size += doc.embedding.length * 8 // 8 bytes per float64
      size += JSON.stringify(doc.metadata).length * 2
      size += 100 // Overhead
    }

    return size
  }
}

export default VectorStore

// Helper to create vector store with LLM service
export const createVectorStoreWithLLM = async (llmService: {
  generateEmbeddings: (texts: string[]) => Promise<number[][]>
}) => {
  const embeddingFunction = async (text: string) => {
    const [embedding] = await llmService.generateEmbeddings([text])
    return embedding
  }

  return new VectorStore(embeddingFunction)
}
