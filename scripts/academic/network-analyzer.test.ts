
import { describe, it, expect } from 'vitest';
import { NetworkAnalyzer } from './network-analyzer';
import { Paper, Author } from './types';

describe('NetworkAnalyzer', () => {
  const analyzer = new NetworkAnalyzer();

  describe('h-index calculation', () => {
    it('should calculate h-index correctly', () => {
      // Mock Author
      const author: Author = {
        id: 'author1',
        name: 'Test Author',
        affiliations: [],
      };

      // Mock Papers with citations
      // We want h-index of 4
      // Papers: 10, 8, 5, 4, 3 citations
      const citations = [10, 8, 5, 4, 3];
      const papers: Paper[] = citations.map((count, index) => ({
        id: `paper${index}`,
        title: `Paper ${index}`,
        abstract: 'Abstract',
        authors: [author],
        publicationDate: '2023',
        fields: [],
        topics: [],
        keywords: [],
        citationCount: count,
        references: [],
        citedBy: [],
        urls: [],
      }));

      const papersMap = new Map<string, Paper>();
      papers.forEach(p => papersMap.set(p.id, p));

      const network = analyzer.buildCollaborationNetwork(papersMap);
      const researcher = network.researchers.get(author.id);

      expect(researcher).toBeDefined();
      expect(researcher?.citation_count).toBe(30);
      expect(researcher?.h_index).toBe(4);
    });

    it('should handle zero citations', () => {
        const author: Author = {
          id: 'author2',
          name: 'Zero Author',
          affiliations: [],
        };

        const citations = [0, 0, 0];
        const papers: Paper[] = citations.map((count, index) => ({
          id: `zpaper${index}`,
          title: `Paper ${index}`,
          abstract: 'Abstract',
          authors: [author],
          publicationDate: '2023',
          fields: [],
          topics: [],
          keywords: [],
          citationCount: count,
          references: [],
          citedBy: [],
          urls: [],
        }));

        const papersMap = new Map<string, Paper>();
        papers.forEach(p => papersMap.set(p.id, p));

        const network = analyzer.buildCollaborationNetwork(papersMap);
        const researcher = network.researchers.get(author.id);

        expect(researcher?.citation_count).toBe(0);
        expect(researcher?.h_index).toBe(0);
    });

    it('should handle h-index where citations equal rank', () => {
        // [3, 3, 3] -> h-index 3
        const author: Author = {
          id: 'author3',
          name: 'Equal Author',
          affiliations: [],
        };

        const citations = [3, 3, 3];
        const papers: Paper[] = citations.map((count, index) => ({
          id: `epaper${index}`,
          title: `Paper ${index}`,
          abstract: 'Abstract',
          authors: [author],
          publicationDate: '2023',
          fields: [],
          topics: [],
          keywords: [],
          citationCount: count,
          references: [],
          citedBy: [],
          urls: [],
        }));

        const papersMap = new Map<string, Paper>();
        papers.forEach(p => papersMap.set(p.id, p));

        const network = analyzer.buildCollaborationNetwork(papersMap);
        const researcher = network.researchers.get(author.id);

        expect(researcher?.citation_count).toBe(9);
        expect(researcher?.h_index).toBe(3);
    });
  });
});
