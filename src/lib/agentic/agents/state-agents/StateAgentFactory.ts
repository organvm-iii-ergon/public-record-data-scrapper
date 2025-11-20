/**
 * State Agent Factory
 * Creates and manages state-specific agents for all 50 US states + territories
 */

import { StateAgent, type StateConfig } from './StateAgent'

export interface StateAgentRegistry {
  [stateCode: string]: StateAgent
}

// Complete US state configurations
export const STATE_CONFIGS: StateConfig[] = [
  // Northeast
  {
    stateCode: 'NY',
    stateName: 'New York',
    portalUrl: 'https://appext20.dos.ny.gov/pls/ucc_public/web_search.main_frame',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 30, requestsPerHour: 500, requestsPerDay: 5000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'NJ',
    stateName: 'New Jersey',
    portalUrl: 'https://www.njportal.com/DOR/UCCSearch',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'PA',
    stateName: 'Pennsylvania',
    portalUrl: 'https://www.corporations.pa.gov/search/corpsearch',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 25, requestsPerHour: 450, requestsPerDay: 4500 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'MA',
    stateName: 'Massachusetts',
    portalUrl: 'https://www.sec.state.ma.us/cor/corucc/uccidx.htm',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'CT',
    stateName: 'Connecticut',
    portalUrl: 'https://www.concord-sots.ct.gov/CONCORD/online',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },

  // South
  {
    stateCode: 'FL',
    stateName: 'Florida',
    portalUrl: 'https://dos.myflorida.com/sunbiz/search/',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 40, requestsPerHour: 800, requestsPerDay: 8000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'TX',
    stateName: 'Texas',
    portalUrl: 'https://www.sos.state.tx.us/corp/soscorporate/corporationsearchdirect.shtml',
    apiEndpoint: 'https://www.sos.state.tx.us/corp/soscorporate/api',
    requiresAuth: true,
    rateLimit: { requestsPerMinute: 50, requestsPerHour: 1000, requestsPerDay: 10000 },
    dataFormat: 'json',
    updateFrequency: 'hourly',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'GA',
    stateName: 'Georgia',
    portalUrl: 'https://ecorp.sos.ga.gov/BusinessSearch',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 30, requestsPerHour: 600, requestsPerDay: 6000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'NC',
    stateName: 'North Carolina',
    portalUrl: 'https://www.sosnc.gov/search/index/corp',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 25, requestsPerHour: 500, requestsPerDay: 5000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'VA',
    stateName: 'Virginia',
    portalUrl: 'https://cis.scc.virginia.gov/EntitySearch/Index',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },

  // Midwest
  {
    stateCode: 'IL',
    stateName: 'Illinois',
    portalUrl: 'https://apps.ilsos.gov/corporatellc/',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 35, requestsPerHour: 700, requestsPerDay: 7000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'OH',
    stateName: 'Ohio',
    portalUrl: 'https://businesssearch.ohiosos.gov/',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 30, requestsPerHour: 600, requestsPerDay: 6000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'MI',
    stateName: 'Michigan',
    portalUrl: 'https://cofs.lara.state.mi.us/searchucc/home.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 25, requestsPerHour: 500, requestsPerDay: 5000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Detroit', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'IN',
    stateName: 'Indiana',
    portalUrl: 'https://bsd.sos.in.gov/publicbusinesssearch',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Indianapolis', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'WI',
    stateName: 'Wisconsin',
    portalUrl: 'https://www.wdfi.org/apps/CorpSearch/Search.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },

  // West
  {
    stateCode: 'CA',
    stateName: 'California',
    portalUrl: 'https://bizfileonline.sos.ca.gov/search/business',
    apiEndpoint: 'https://bizfileonline.sos.ca.gov/api',
    requiresAuth: true,
    rateLimit: { requestsPerMinute: 60, requestsPerHour: 1200, requestsPerDay: 12000 },
    dataFormat: 'json',
    updateFrequency: 'hourly',
    businessHours: { timezone: 'America/Los_Angeles', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'WA',
    stateName: 'Washington',
    portalUrl: 'https://ccfs.sos.wa.gov/#/',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 30, requestsPerHour: 600, requestsPerDay: 6000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Los_Angeles', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'OR',
    stateName: 'Oregon',
    portalUrl: 'https://egov.sos.state.or.us/br/pkg_web_name_srch_inq.login',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 25, requestsPerHour: 500, requestsPerDay: 5000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Los_Angeles', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'AZ',
    stateName: 'Arizona',
    portalUrl: 'https://ecorp.azcc.gov/EntitySearch/Index',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 30, requestsPerHour: 600, requestsPerDay: 6000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Phoenix', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'NV',
    stateName: 'Nevada',
    portalUrl: 'https://esos.nv.gov/EntitySearch/OnlineEntitySearch',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 25, requestsPerHour: 500, requestsPerDay: 5000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Los_Angeles', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'CO',
    stateName: 'Colorado',
    portalUrl: 'https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 30, requestsPerHour: 600, requestsPerDay: 6000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Denver', start: '08:00', end: '17:00' }
  },

  // Additional Midwest
  {
    stateCode: 'MN',
    stateName: 'Minnesota',
    portalUrl: 'https://mblsportal.sos.state.mn.us/Business/Search',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 25, requestsPerHour: 500, requestsPerDay: 5000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'MO',
    stateName: 'Missouri',
    portalUrl: 'https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'IA',
    stateName: 'Iowa',
    portalUrl: 'https://sos.iowa.gov/search/business/(S(default))/search.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'KS',
    stateName: 'Kansas',
    portalUrl: 'https://www.kansas.gov/bess/flow/main',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'NE',
    stateName: 'Nebraska',
    portalUrl: 'https://www.nebraska.gov/sos/corp/corpsearch.cgi',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'SD',
    stateName: 'South Dakota',
    portalUrl: 'https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'ND',
    stateName: 'North Dakota',
    portalUrl: 'https://firststop.sos.nd.gov/search/business',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },

  // Additional South
  {
    stateCode: 'TN',
    stateName: 'Tennessee',
    portalUrl: 'https://tnbear.tn.gov/ECommerce/FilingSearch.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 25, requestsPerHour: 500, requestsPerDay: 5000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'LA',
    stateName: 'Louisiana',
    portalUrl: 'https://coraweb.sos.la.gov/commercialsearch/commercialsearch.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'KY',
    stateName: 'Kentucky',
    portalUrl: 'https://web.sos.ky.gov/ftsearch/(S(default))/default.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'SC',
    stateName: 'South Carolina',
    portalUrl: 'https://businessfilings.sc.gov/BusinessFiling/Entity/Search',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'AL',
    stateName: 'Alabama',
    portalUrl: 'https://arc-sos.state.al.us/cgi/corpname.mbr/input',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'MS',
    stateName: 'Mississippi',
    portalUrl: 'https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'AR',
    stateName: 'Arkansas',
    portalUrl: 'https://www.ark.org/sos/corps/search_all.php',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'WV',
    stateName: 'West Virginia',
    portalUrl: 'https://apps.sos.wv.gov/business/corporations/',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'MD',
    stateName: 'Maryland',
    portalUrl: 'https://egov.maryland.gov/BusinessExpress/EntitySearch',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 25, requestsPerHour: 500, requestsPerDay: 5000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'DE',
    stateName: 'Delaware',
    portalUrl: 'https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 30, requestsPerHour: 600, requestsPerDay: 6000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'DC',
    stateName: 'District of Columbia',
    portalUrl: 'https://corponline.dcra.dc.gov/Account.aspx/LogOn',
    requiresAuth: true,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'OK',
    stateName: 'Oklahoma',
    portalUrl: 'https://www.sos.ok.gov/corp/corpInquiryFind.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Chicago', start: '08:00', end: '17:00' }
  },

  // Additional Northeast
  {
    stateCode: 'RI',
    stateName: 'Rhode Island',
    portalUrl: 'https://business.sos.ri.gov/CorpWeb/CorpSearch/CorpSearch.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'VT',
    stateName: 'Vermont',
    portalUrl: 'https://www.vtsosonline.com/online/BusinessInquire/',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'NH',
    stateName: 'New Hampshire',
    portalUrl: 'https://quickstart.sos.nh.gov/online/BusinessInquire',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'ME',
    stateName: 'Maine',
    portalUrl: 'https://icrs.informe.org/nei-sos-icrs/ICRS',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/New_York', start: '08:00', end: '17:00' }
  },

  // Additional West
  {
    stateCode: 'UT',
    stateName: 'Utah',
    portalUrl: 'https://secure.utah.gov/bes/index.html',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 25, requestsPerHour: 500, requestsPerDay: 5000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Denver', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'NM',
    stateName: 'New Mexico',
    portalUrl: 'https://portal.sos.state.nm.us/BFS/online/CorporationBusinessSearch',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Denver', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'ID',
    stateName: 'Idaho',
    portalUrl: 'https://sosbiz.idaho.gov/search/business',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Boise', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'MT',
    stateName: 'Montana',
    portalUrl: 'https://biz.sosmt.gov/search/business',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Denver', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'WY',
    stateName: 'Wyoming',
    portalUrl: 'https://wyobiz.wyo.gov/Business/FilingSearch.aspx',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Denver', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'AK',
    stateName: 'Alaska',
    portalUrl: 'https://www.commerce.alaska.gov/cbp/main/search/entities',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 15, requestsPerHour: 300, requestsPerDay: 3000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'America/Anchorage', start: '08:00', end: '17:00' }
  },
  {
    stateCode: 'HI',
    stateName: 'Hawaii',
    portalUrl: 'https://hbe.ehawaii.gov/documents/search.html',
    requiresAuth: false,
    rateLimit: { requestsPerMinute: 20, requestsPerHour: 400, requestsPerDay: 4000 },
    dataFormat: 'html',
    updateFrequency: 'daily',
    businessHours: { timezone: 'Pacific/Honolulu', start: '08:00', end: '17:00' }
  }
]

export class StateAgentFactory {
  private registry: StateAgentRegistry = {}

  /**
   * Create agents for all US states
   */
  createAllStateAgents(): StateAgentRegistry {
    for (const config of STATE_CONFIGS) {
      const agent = new StateAgent(config)
      this.registry[config.stateCode] = agent
    }
    return this.registry
  }

  /**
   * Create agents for specific states
   */
  createStateAgents(stateCodes: string[]): StateAgentRegistry {
    const selectedAgents: StateAgentRegistry = {}

    for (const stateCode of stateCodes) {
      const config = STATE_CONFIGS.find(c => c.stateCode === stateCode)
      if (config) {
        const agent = new StateAgent(config)
        selectedAgents[stateCode] = agent
        this.registry[stateCode] = agent
      }
    }

    return selectedAgents
  }

  /**
   * Get agent for specific state
   */
  getAgent(stateCode: string): StateAgent | undefined {
    return this.registry[stateCode]
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): StateAgentRegistry {
    return { ...this.registry }
  }

  /**
   * Get agents by region
   */
  getAgentsByRegion(region: 'northeast' | 'south' | 'midwest' | 'west'): StateAgentRegistry {
    const regionMap = {
      northeast: ['NY', 'NJ', 'PA', 'MA', 'CT', 'RI', 'VT', 'NH', 'ME'],
      south: ['FL', 'TX', 'GA', 'NC', 'VA', 'SC', 'TN', 'AL', 'MS', 'LA', 'AR', 'KY', 'WV', 'MD', 'DE', 'DC'],
      midwest: ['IL', 'OH', 'MI', 'IN', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'SD', 'ND'],
      west: ['CA', 'WA', 'OR', 'AZ', 'NV', 'CO', 'UT', 'NM', 'ID', 'MT', 'WY', 'AK', 'HI']
    }

    const stateCodes = regionMap[region]
    const regionAgents: StateAgentRegistry = {}

    for (const stateCode of stateCodes) {
      if (this.registry[stateCode]) {
        regionAgents[stateCode] = this.registry[stateCode]
      }
    }

    return regionAgents
  }

  /**
   * Get count of registered agents
   */
  getAgentCount(): number {
    return Object.keys(this.registry).length
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.registry = {}
  }
}

// Singleton instance
export const stateAgentFactory = new StateAgentFactory()
