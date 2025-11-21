/**
 * Academic Knowledge Production CLI
 *
 * Command-line interface for automated research tools
 */

import { SemanticScholarCollector } from './semantic-scholar-collector'
import { ArXivCollector, ARXIV_CATEGORIES } from './arxiv-collector'
import { NetworkAnalyzer, exampleAnalysis } from './network-analyzer'
import type { SearchQuery } from './types'

const COMMANDS = {
  search: 'Search for papers across all sources',
  network: 'Build and analyze citation network',
  trends: 'Identify trending topics in a field',
  collab: 'Analyze collaboration networks',
  author: 'Get papers by author',
  recent: 'Get recent papers in a category',
  help: 'Show this help message'
}

async function searchPapers(args: string[]) {
  const query = args.join(' ')

  if (!query) {
    console.error('❌ Please provide a search query')
    console.error('Usage: npm run academic:search "machine learning"')
    return
  }

  console.log(`\n🔍 Searching for: "${query}"\n`)

  // Search Semantic Scholar
  console.log('📚 Semantic Scholar:')
  const ssCollector = new SemanticScholarCollector()
  const ssResults = await ssCollector.searchPapers({ query, limit: 10 })

  ssResults.papers.forEach((paper, i) => {
    console.log(`${i + 1}. ${paper.title}`)
    console.log(`   Authors: ${paper.authors.map(a => a.name).join(', ')}`)
    console.log(`   Year: ${paper.publicationDate}`)
    console.log(`   Citations: ${paper.citationCount}`)
    console.log(`   URL: ${paper.urls[0]}`)
    console.log()
  })

  // Search arXiv
  console.log('\n📄 arXiv:')
  const arxivCollector = new ArXivCollector()
  const arxivResults = await arxivCollector.searchPapers({ query, limit: 10 })

  arxivResults.papers.forEach((paper, i) => {
    console.log(`${i + 1}. ${paper.title}`)
    console.log(`   Authors: ${paper.authors.map(a => a.name).join(', ')}`)
    console.log(`   Year: ${paper.publicationDate.split('-')[0]}`)
    console.log(`   Categories: ${paper.fields.join(', ')}`)
    console.log(`   URL: ${paper.urls[0]}`)
    console.log()
  })

  console.log(`\n✅ Total results: ${ssResults.total + arxivResults.total}`)
}

async function buildNetwork(args: string[]) {
  const topic = args.join(' ')

  if (!topic) {
    console.error('❌ Please provide a topic')
    console.error('Usage: npm run academic:network "neural networks"')
    return
  }

  console.log(`\n🕸️  Building citation network for: "${topic}"\n`)

  const collector = new SemanticScholarCollector()
  const network = await collector.buildCitationNetwork(topic, 50)

  const analyzer = new NetworkAnalyzer()
  await exampleAnalysis(network)
}

async function findTrends(args: string[]) {
  const field = args[0]

  if (!field) {
    console.error('❌ Please provide a field')
    console.error('Usage: npm run academic:trends cs.AI')
    console.error('\nAvailable arXiv categories:')
    Object.entries(ARXIV_CATEGORIES).forEach(([code, name]) => {
      console.error(`  ${code.padEnd(12)} - ${name}`)
    })
    return
  }

  console.log(`\n📈 Finding trending topics in: ${field}\n`)

  const collector = new ArXivCollector()
  const topics = await collector.getTrendingTopics(field, 30)

  console.log(`\nTop trending topics (last 30 days):`)
  Array.from(topics.entries()).forEach(([topic, count], i) => {
    const name = ARXIV_CATEGORIES[topic as keyof typeof ARXIV_CATEGORIES] || topic
    console.log(`${i + 1}. ${name.padEnd(40)} ${count} papers`)
  })
}

async function analyzeCollaboration(args: string[]) {
  const topic = args.join(' ')

  if (!topic) {
    console.error('❌ Please provide a topic')
    console.error('Usage: npm run academic:collab "machine learning"')
    return
  }

  console.log(`\n🤝 Analyzing collaborations in: "${topic}"\n`)

  const collector = new SemanticScholarCollector()
  const result = await collector.searchPapers({ query: topic, limit: 100 })

  console.log(`Found ${result.papers.length} papers\n`)

  const analyzer = new NetworkAnalyzer()
  const papers = new Map(result.papers.map(p => [p.id, p]))
  const network = analyzer.buildCollaborationNetwork(papers)

  console.log(`👥 Collaboration Network Statistics:`)
  console.log(`   Researchers: ${network.researchers.size}`)
  console.log(`   Collaborations: ${network.collaborations.length}`)
  console.log(`   Research Teams: ${network.teams.length}\n`)

  // Top collaborative researchers
  const topResearchers = Array.from(network.researchers.values())
    .sort((a, b) => b.collaboration_count - a.collaboration_count)
    .slice(0, 10)

  console.log(`🏆 Most Collaborative Researchers:`)
  topResearchers.forEach((researcher, i) => {
    console.log(`${i + 1}. ${researcher.name}`)
    console.log(`   Papers: ${researcher.papers.length}`)
    console.log(`   Collaborators: ${researcher.collaborators.length}`)
    console.log(`   Topics: ${researcher.topics.slice(0, 3).join(', ')}`)
    console.log()
  })

  // Top teams
  console.log(`\n🏆 Top Research Teams:`)
  network.teams.slice(0, 5).forEach((team, i) => {
    const leaderName = network.researchers.get(team.leader!)?.name || 'Unknown'
    console.log(`${i + 1}. ${team.name}`)
    console.log(`   Leader: ${leaderName}`)
    console.log(`   Members: ${team.core_members.length}`)
    console.log(`   Papers: ${team.papers.length}`)
    console.log(`   Topics: ${team.topics.join(', ')}`)
    console.log()
  })
}

async function getAuthorPapers(args: string[]) {
  const authorName = args.join(' ')

  if (!authorName) {
    console.error('❌ Please provide an author name')
    console.error('Usage: npm run academic:author "Geoffrey Hinton"')
    return
  }

  console.log(`\n📚 Finding papers by: ${authorName}\n`)

  // Search arXiv
  console.log('arXiv:')
  const arxivCollector = new ArXivCollector()
  const arxivPapers = await arxivCollector.getPapersByAuthor(authorName, 20)

  console.log(`Found ${arxivPapers.length} papers\n`)

  arxivPapers.forEach((paper, i) => {
    console.log(`${i + 1}. ${paper.title}`)
    console.log(`   Year: ${paper.publicationDate.split('-')[0]}`)
    console.log(`   Categories: ${paper.fields.slice(0, 3).join(', ')}`)
    console.log()
  })
}

async function getRecentPapers(args: string[]) {
  const category = args[0]
  const days = parseInt(args[1]) || 7

  if (!category) {
    console.error('❌ Please provide a category')
    console.error('Usage: npm run academic:recent cs.AI [days]')
    console.error('\nPopular categories:')
    console.error('  cs.AI - Artificial Intelligence')
    console.error('  cs.LG - Machine Learning')
    console.error('  cs.CL - Computation and Language')
    console.error('  cs.CV - Computer Vision')
    console.error('  q-bio.QM - Quantitative Methods (Biology)')
    console.error('  stat.ML - Machine Learning (Statistics)')
    return
  }

  console.log(`\n📅 Recent papers in ${category} (last ${days} days)\n`)

  const collector = new ArXivCollector()
  const papers = await collector.getRecentPapers(category, days, 50)

  console.log(`Found ${papers.length} papers\n`)

  papers.forEach((paper, i) => {
    console.log(`${i + 1}. ${paper.title}`)
    console.log(`   Authors: ${paper.authors.slice(0, 3).map(a => a.name).join(', ')}${paper.authors.length > 3 ? '...' : ''}`)
    console.log(`   Date: ${paper.publicationDate}`)
    console.log(`   URL: ${paper.urls[0]}`)
    console.log()
  })
}

function showHelp() {
  console.log(`
🧠 Academic Knowledge Production CLI

Commands:
  search <query>       Search for papers across all sources
  network <topic>      Build and analyze citation network for a topic
  trends <field>       Identify trending topics in an arXiv field
  collab <topic>       Analyze collaboration networks for a topic
  author <name>        Get papers by author
  recent <category>    Get recent papers in an arXiv category
  help                 Show this help message

Examples:
  npm run academic:search "machine learning interpretability"
  npm run academic:network "neural networks"
  npm run academic:trends cs.AI
  npm run academic:collab "quantum computing"
  npm run academic:author "Yann LeCun"
  npm run academic:recent cs.LG 14

ArXiv Categories:
  Computer Science: cs.AI, cs.LG, cs.CV, cs.CL, cs.RO
  Mathematics: math.ST, math.PR, math.CO
  Physics: quant-ph, cond-mat, astro-ph
  Biology: q-bio.QM, q-bio.GN, q-bio.NC
  Statistics: stat.ML, stat.ME, stat.TH

For full category list: https://arxiv.org/category_taxonomy
`)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    showHelp()
    return
  }

  const command = args[0]
  const commandArgs = args.slice(1)

  try {
    switch (command) {
      case 'search':
        await searchPapers(commandArgs)
        break

      case 'network':
        await buildNetwork(commandArgs)
        break

      case 'trends':
        await findTrends(commandArgs)
        break

      case 'collab':
        await analyzeCollaboration(commandArgs)
        break

      case 'author':
        await getAuthorPapers(commandArgs)
        break

      case 'recent':
        await getRecentPapers(commandArgs)
        break

      case 'help':
      default:
        showHelp()
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error}`)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}
