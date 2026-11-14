// Deterministic Ackee fixtures for the tester-env stack.
//
// Executed by `./tester-env seed` through the mongo:7 service:
//   docker compose exec -T mongo mongosh --quiet mongodb://localhost:27017/ackee --eval "$(cat this-file)"
//
// Why direct inserts: Ackee's createRecord GraphQL mutation always sets
// `created`/`updated` to now (src/models/record.js), but every statistic is a
// relative-date aggregate (24 hours / 7 days / 30 days / 6 months, plus daily
// chart buckets). Historical pageviews therefore need explicit timestamps.
//
// Determinism:
//   * Fixed ids, titles, URLs, referrers, devices and durations.
//   * Volumes are anchored to the seed run: recent pageviews sit inside the
//     last 25 minutes (so 24h views and the daily bucket are populated), and
//     historical pageviews sit at 14:00 UTC of a calendar day N days ago, so
//     the daily/monthly buckets never straddle a day boundary.
//   * The five seeded collections are cleared before inserting, so
//     `seed` is idempotent and `reset -> deploy -> seed` is reproducible.
//
// Totals (checked by `./tester-env verify`):
//   3 domains, 137 pageviews (14 in 24 hours, 59 in 7 days, 104 in 30 days),
//   4 custom events, 39 actions, 1 permanent token.

const now = new Date()
const DAY = 24 * 60 * 60 * 1000

const startOfDayUTC = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

// 14:00 UTC on the calendar day `daysAgo` days before today. Mid-day UTC keeps
// the document inside its intended day bucket for every plausible client
// timezone and keeps each bucket a full calendar day away from a range edge.
const dayAt = (daysAgo, hourUTC) =>
  new Date(startOfDayUTC(now).getTime() - daysAgo * DAY + (hourUTC == null ? 14 : hourUTC) * 60 * 60 * 1000)

// Minutes ago, but never before the start of the UTC day: the newest pageviews
// must belong to "views today" even when the seed runs shortly after midnight.
// Hours ago, used for "yesterday" actions that must stay outside the 24 hours filter.
const hoursAgo = (hours) => new Date(now.getTime() - hours * 60 * 60 * 1000)

const minutesAgoToday = (minutes) => {
  const natural = new Date(now.getTime() - minutes * 60 * 1000)
  const floor = new Date(startOfDayUTC(now).getTime() + 60 * 1000)
  return natural < floor ? floor : natural
}

const secondsAgo = (seconds) => new Date(now.getTime() - seconds * 1000)

const DOMAINS = [
  { key: 'journal', id: '6f1d6a2c-1f4e-4c3a-9b21-5f7a0e2d3c01', title: 'Northstar Journal' },
  { key: 'store', id: '6f1d6a2c-1f4e-4c3a-9b21-5f7a0e2d3c02', title: 'Harbor Store' },
  { key: 'docs', id: '6f1d6a2c-1f4e-4c3a-9b21-5f7a0e2d3c03', title: 'Northstar Docs' },
]

const SITE = {
  journal: 'https://journal.northstar.example',
  store: 'https://shop.northstar.example',
  docs: 'https://docs.northstar.example',
}

const GOOGLE = 'https://www.google.com/'
const TWITTER = 'https://twitter.com/'
const HACKER_NEWS = 'https://news.ycombinator.com/'
const NEWSLETTER = 'https://mail.northstar.example/issue-14'

// Visitor profiles keep every derived list coherent: one browser/os/device per
// client so "Safari 17.5", "macOS 14.5" and "Apple MacBook Pro" counts match.
const VISITORS = {
  journal: [
    {
      clientId: 'seed-journal-01',
      siteLanguage: 'en',
      deviceManufacturer: 'Apple',
      deviceName: 'MacBook Pro',
      osName: 'macOS',
      osVersion: '14.5',
      browserName: 'Safari',
      browserVersion: '17.5',
      screenWidth: 1728,
      screenHeight: 1117,
      browserWidth: 1512,
      browserHeight: 945,
      screenColorDepth: 30,
    },
    {
      clientId: 'seed-journal-02',
      siteLanguage: 'de',
      deviceManufacturer: 'Lenovo',
      deviceName: 'ThinkPad T14',
      osName: 'Windows',
      osVersion: '11',
      browserName: 'Chrome',
      browserVersion: '127.0',
      screenWidth: 2560,
      screenHeight: 1440,
      browserWidth: 1920,
      browserHeight: 1080,
      screenColorDepth: 24,
    },
    {
      clientId: 'seed-journal-03',
      siteLanguage: 'en',
      deviceManufacturer: 'Apple',
      deviceName: 'iPhone 15',
      osName: 'iOS',
      osVersion: '17.5',
      browserName: 'Mobile Safari',
      browserVersion: '17.5',
      screenWidth: 390,
      screenHeight: 844,
      browserWidth: 390,
      browserHeight: 664,
      screenColorDepth: 30,
    },
    {
      clientId: 'seed-journal-04',
      siteLanguage: 'fr',
      deviceManufacturer: 'Google',
      deviceName: 'Pixel 8',
      osName: 'Android',
      osVersion: '14',
      browserName: 'Chrome',
      browserVersion: '127.0',
      screenWidth: 412,
      screenHeight: 915,
      browserWidth: 412,
      browserHeight: 823,
      screenColorDepth: 24,
    },
    {
      clientId: 'seed-journal-05',
      siteLanguage: 'en',
      deviceManufacturer: 'Microsoft',
      deviceName: 'Surface Laptop 5',
      osName: 'Windows',
      osVersion: '11',
      browserName: 'Edge',
      browserVersion: '127.0',
      screenWidth: 2256,
      screenHeight: 1504,
      browserWidth: 1536,
      browserHeight: 864,
      screenColorDepth: 24,
    },
    {
      clientId: 'seed-journal-06',
      siteLanguage: 'nl',
      deviceManufacturer: 'Lenovo',
      deviceName: 'ThinkPad T14',
      osName: 'Ubuntu',
      osVersion: '24.04',
      browserName: 'Firefox',
      browserVersion: '128.0',
      screenWidth: 1920,
      screenHeight: 1080,
      browserWidth: 1440,
      browserHeight: 900,
      screenColorDepth: 24,
    },
  ],
  store: [
    {
      clientId: 'seed-store-01',
      siteLanguage: 'en',
      deviceManufacturer: 'Dell',
      deviceName: 'XPS 13',
      osName: 'Windows',
      osVersion: '11',
      browserName: 'Chrome',
      browserVersion: '127.0',
      screenWidth: 1920,
      screenHeight: 1200,
      browserWidth: 1600,
      browserHeight: 960,
      screenColorDepth: 24,
    },
    {
      clientId: 'seed-store-02',
      siteLanguage: 'en',
      deviceManufacturer: 'Apple',
      deviceName: 'MacBook Air',
      osName: 'macOS',
      osVersion: '15.1',
      browserName: 'Safari',
      browserVersion: '18.1',
      screenWidth: 1470,
      screenHeight: 956,
      browserWidth: 1470,
      browserHeight: 860,
      screenColorDepth: 30,
    },
    {
      clientId: 'seed-store-03',
      siteLanguage: 'es',
      deviceManufacturer: 'Apple',
      deviceName: 'iPhone 14',
      osName: 'iOS',
      osVersion: '18.1',
      browserName: 'Mobile Safari',
      browserVersion: '18.1',
      screenWidth: 390,
      screenHeight: 844,
      browserWidth: 390,
      browserHeight: 664,
      screenColorDepth: 30,
    },
  ],
  docs: [
    {
      clientId: 'seed-docs-01',
      siteLanguage: 'en',
      deviceManufacturer: 'Apple',
      deviceName: 'MacBook Pro',
      osName: 'macOS',
      osVersion: '15.1',
      browserName: 'Safari',
      browserVersion: '18.1',
      screenWidth: 1512,
      screenHeight: 982,
      browserWidth: 1440,
      browserHeight: 900,
      screenColorDepth: 30,
    },
    {
      clientId: 'seed-docs-02',
      siteLanguage: 'en',
      deviceManufacturer: 'Lenovo',
      deviceName: 'ThinkPad T14',
      osName: 'Linux',
      osVersion: '6.8',
      browserName: 'Firefox',
      browserVersion: '128.0',
      screenWidth: 1920,
      screenHeight: 1080,
      browserWidth: 1920,
      browserHeight: 1080,
      screenColorDepth: 24,
    },
  ],
}

const DURATIONS = [45, 90, 120, 180, 240, 300, 420, 600, 900]
const HISTORY_REFERRERS = [GOOGLE, null, TWITTER, null, HACKER_NEWS, null, NEWSLETTER]

const JOURNAL_PATHS = ['/', '/essays/field-notes', '/essays/tide-tables', '/archive', '/about', '/newsletter', '/pricing']
const STORE_PATHS = ['/', '/products/anchor-lamp', '/products/tide-clock', '/cart', '/checkout']
const DOCS_PATHS = ['/docs/intro', '/docs/api']

const records = []
let recordSequence = 0

const addRecord = (context) => {
  const visit = VISITORS[context.domain][context.visitor]
  const created = context.created
  const updated = context.updated == null ? new Date(created.getTime() + context.duration * 1000) : context.updated

  recordSequence += 1
  records.push({
    id: 'seed-record-' + String(recordSequence).padStart(4, '0'),
    domainId: DOMAINS.filter((domain) => domain.key === context.domain)[0].id,
    clientId: visit.clientId,
    siteLocation: SITE[context.domain] + context.path,
    siteReferrer: context.referrer == null ? undefined : context.referrer,
    siteLanguage: visit.siteLanguage,
    deviceManufacturer: visit.deviceManufacturer,
    deviceName: visit.deviceName,
    osName: visit.osName,
    osVersion: visit.osVersion,
    browserName: visit.browserName,
    browserVersion: visit.browserVersion,
    screenWidth: visit.screenWidth,
    screenHeight: visit.screenHeight,
    screenColorDepth: visit.screenColorDepth,
    browserWidth: visit.browserWidth,
    browserHeight: visit.browserHeight,
    created: created,
    updated: updated,
  })
}

// "Recent" pageviews: today's traffic, all inside the last 25 minutes so the
// 24 hours filters, the daily bucket and the Live counter all see them.
const RECENT = [
  // Journal: 9 pageviews, 4 from Google, 1 Twitter, 1 Hacker News, 3 direct.
  { domain: 'journal', path: '/', referrer: GOOGLE, visitor: 0, minutes: 25 },
  { domain: 'journal', path: '/', referrer: null, visitor: 2, minutes: 23 },
  { domain: 'journal', path: '/essays/field-notes', referrer: GOOGLE, visitor: 0, minutes: 21 },
  { domain: 'journal', path: '/essays/field-notes', referrer: TWITTER, visitor: 3, minutes: 19 },
  { domain: 'journal', path: '/essays/tide-tables', referrer: GOOGLE, visitor: 1, minutes: 17 },
  { domain: 'journal', path: '/archive', referrer: HACKER_NEWS, visitor: 4, minutes: 15 },
  { domain: 'journal', path: '/about', referrer: null, visitor: 5, minutes: 13 },
  { domain: 'journal', path: '/pricing', referrer: null, visitor: 1, minutes: 12 },
  { domain: 'journal', path: '/newsletter', referrer: GOOGLE, visitor: 4, minutes: 11 },
  // Store: 5 pageviews, 1 from Google, 1 from the newsletter, 3 direct.
  { domain: 'store', path: '/', referrer: GOOGLE, visitor: 0, minutes: 24 },
  { domain: 'store', path: '/products/anchor-lamp', referrer: GOOGLE, visitor: 1, minutes: 20 },
  { domain: 'store', path: '/products/anchor-lamp', referrer: NEWSLETTER, visitor: 2, minutes: 18 },
  { domain: 'store', path: '/products/tide-clock', referrer: null, visitor: 0, minutes: 14 },
  { domain: 'store', path: '/checkout', referrer: null, visitor: 1, minutes: 10 },
]

// Three journal visitors are still on the page right now, which keeps the
// "Active visitors" fact non-zero at verify time (Ackee only counts records
// updated within the last 30 seconds).
const LIVE = { 0: 6, 2: 11, 4: 3 }

RECENT.forEach((entry, index) => {
  const created = minutesAgoToday(entry.minutes)
  const liveSeconds = LIVE[index]
  addRecord({
    domain: entry.domain,
    path: entry.path,
    referrer: entry.referrer,
    visitor: entry.visitor,
    created: created,
    duration: DURATIONS[index % DURATIONS.length],
    updated: liveSeconds == null ? undefined : secondsAgo(liveSeconds),
  })
})

// "Yesterday" pageviews sit 25 hours back: old enough to stay outside the
// 24 hours filter at every time of day, recent enough to keep the daily bars
// populated. Buckets are calendar based, so these land on yesterday's bar.
const YESTERDAY = [
  { domain: 'journal', path: '/archive', visitor: 0, hours: 25 },
  { domain: 'journal', path: '/about', visitor: 1, hours: 25 },
  { domain: 'journal', path: '/newsletter', visitor: 2, hours: 25 },
  { domain: 'journal', path: '/pricing', visitor: 3, hours: 25 },
  { domain: 'journal', path: '/', visitor: 4, hours: 25 },
  { domain: 'journal', path: '/essays/field-notes', visitor: 5, hours: 25 },
  { domain: 'journal', path: '/essays/tide-tables', visitor: 0, hours: 25 },
  { domain: 'store', path: '/cart', visitor: 1, hours: 25 },
  { domain: 'store', path: '/checkout', visitor: 2, hours: 25 },
]

YESTERDAY.forEach((entry, index) => {
  addRecord({
    domain: entry.domain,
    path: entry.path,
    referrer: HISTORY_REFERRERS[index % HISTORY_REFERRERS.length],
    visitor: entry.visitor,
    created: new Date(now.getTime() - entry.hours * 60 * 60 * 1000),
    duration: DURATIONS[index % DURATIONS.length],
  })
})

// Historical pageviews. [daysAgo, count]: pages are taken from a rotating
// slice of the path list so page rankings change between ranges.
const JOURNAL_HISTORY = [
  [2, 5],
  [3, 6],
  [4, 5],
  [5, 7],
  [6, 5],
  [8, 5],
  [9, 5],
  [10, 5],
  [11, 5],
  [12, 5],
  [13, 5],
  [22, 2],
  [23, 2],
  [24, 2],
  [25, 2],
  [26, 2],
  [45, 2],
  [62, 2],
  [90, 3],
  [120, 4],
  [150, 5],
]

const STORE_HISTORY = [
  [2, 2],
  [3, 1],
  [4, 2],
  [5, 2],
  [6, 1],
  [22, 1],
  [23, 1],
  [24, 1],
  [25, 1],
  [26, 1],
  [45, 2],
  [90, 2],
  [150, 3],
]

const DOCS_HISTORY = [
  [60, 2],
  [75, 2],
  [90, 2],
  [120, 2],
  [150, 2],
]

const addHistory = (domain, paths, history, stride) => {
  history.forEach((entry) => {
    const daysAgo = entry[0]
    const count = entry[1]
    const offset = (daysAgo * stride) % paths.length

    for (let index = 0; index < count; index += 1) {
      const path = paths[(offset + index) % paths.length]
      addRecord({
        domain: domain,
        path: path,
        referrer: HISTORY_REFERRERS[(daysAgo + index) % HISTORY_REFERRERS.length],
        visitor: (daysAgo + index) % VISITORS[domain].length,
        created: dayAt(daysAgo),
        duration: DURATIONS[(daysAgo + index) % DURATIONS.length],
      })
    }
  })
}

addHistory('journal', JOURNAL_PATHS, JOURNAL_HISTORY, 3)
addHistory('store', STORE_PATHS, STORE_HISTORY, 3)
addHistory('docs', DOCS_PATHS, DOCS_HISTORY, 1)

// Custom events. Ids are fixed so reseeding is idempotent.
const EVENTS = [
  { id: '9e0c1f4a-0000-4000-8000-000000000101', title: 'Newsletter signup', type: 'TOTAL_LIST' },
  { id: '9e0c1f4a-0000-4000-8000-000000000102', title: 'Checkout completed', type: 'TOTAL_CHART' },
  { id: '9e0c1f4a-0000-4000-8000-000000000103', title: 'Reading time', type: 'AVERAGE_CHART' },
  { id: '9e0c1f4a-0000-4000-8000-000000000104', title: 'Article rating', type: 'AVERAGE_LIST' },
].map((event) => ({ ...event, created: dayAt(180, 9), updated: dayAt(180, 9) }))

const actions = []
let actionSequence = 0

const addAction = (title, created, key, value, details) => {
  const event = EVENTS.filter((entry) => entry.title === title)[0]
  actionSequence += 1
  actions.push({
    id: 'seed-action-' + String(actionSequence).padStart(4, '0'),
    eventId: event.id,
    key: key,
    value: value,
    details: details == null ? undefined : details,
    created: created,
    updated: created,
  })
}

// Newsletter signup: today header 3 / footer 2 / article 1.
addAction('Newsletter signup', minutesAgoToday(50), 'header', 1, 'hero')
addAction('Newsletter signup', minutesAgoToday(44), 'header', 1, 'hero')
addAction('Newsletter signup', minutesAgoToday(38), 'header', 1, 'nav')
addAction('Newsletter signup', minutesAgoToday(32), 'footer', 1)
addAction('Newsletter signup', minutesAgoToday(26), 'footer', 1, 'essays')
addAction('Newsletter signup', minutesAgoToday(20), 'article', 1, 'field-notes')
addAction('Newsletter signup', hoursAgo(25), 'header', 1, 'hero')
addAction('Newsletter signup', dayAt(2, 9), 'header', 1, 'nav')
addAction('Newsletter signup', dayAt(5, 16), 'header', 1, 'hero')
addAction('Newsletter signup', dayAt(2, 12), 'footer', 1)
addAction('Newsletter signup', dayAt(4, 15), 'footer', 1, 'essays')
addAction('Newsletter signup', dayAt(4, 10), 'article', 1, 'tide-tables')
addAction('Newsletter signup', dayAt(6, 17), 'article', 1, 'archive')
addAction('Newsletter signup', dayAt(22, 10), 'header', 1, 'hero')
addAction('Newsletter signup', dayAt(24, 14), 'header', 1, 'nav')
addAction('Newsletter signup', dayAt(23, 13), 'footer', 1)
addAction('Newsletter signup', dayAt(25, 16), 'footer', 1)
addAction('Newsletter signup', dayAt(26, 11), 'article', 1, 'field-notes')

// Checkout completed: order totals per day.
addAction('Checkout completed', minutesAgoToday(55), 'anchor-lamp', 89, 'order 4821')
addAction('Checkout completed', minutesAgoToday(41), 'tide-clock', 129, 'order 4822')
addAction('Checkout completed', minutesAgoToday(12), 'anchor-lamp', 49, 'order 4823')
addAction('Checkout completed', hoursAgo(25), 'anchor-lamp', 59, 'order 4810')
addAction('Checkout completed', dayAt(2, 12), 'tide-clock', 99, 'order 4811')
addAction('Checkout completed', dayAt(3, 18), 'checkout', 149, 'order 4812')
addAction('Checkout completed', dayAt(5, 11), 'anchor-lamp', 89, 'order 4813')
addAction('Checkout completed', dayAt(23, 15), 'tide-clock', 39, 'order 4780')
addAction('Checkout completed', dayAt(25, 10), 'anchor-lamp', 109, 'order 4781')

// Reading time: seconds per read.
addAction('Reading time', minutesAgoToday(48), 'field-notes', 95, 'seconds')
addAction('Reading time', minutesAgoToday(36), 'tide-tables', 180, 'seconds')
addAction('Reading time', minutesAgoToday(22), 'archive', 240, 'seconds')
addAction('Reading time', dayAt(2, 13), 'field-notes', 120, 'seconds')
addAction('Reading time', dayAt(4, 9), 'field-notes', 210, 'seconds')
addAction('Reading time', dayAt(24, 17), 'archive', 60, 'seconds')

// Article rating: 1-5 stars per article.
addAction('Article rating', minutesAgoToday(46), 'field-notes', 5)
addAction('Article rating', minutesAgoToday(28), 'tide-tables', 4)
addAction('Article rating', hoursAgo(25), 'field-notes', 4)
addAction('Article rating', dayAt(3, 12), 'tide-tables', 5)
addAction('Article rating', dayAt(6, 15), 'archive', 3)
addAction('Article rating', dayAt(22, 12), 'archive', 4)

const domains = DOMAINS.map((domain) => {
  const created = dayAt(210, 9)
  return { id: domain.id, title: domain.title, created: created, updated: created }
})

const permanentTokens = [
  { id: '3c4d5e6f-0000-4000-8000-00000000a001', title: 'Newsletter relay', created: dayAt(180, 9), updated: dayAt(180, 9) },
]

// Idempotent reseed: the fixture set is the canonical analytics state.
db.getCollection('records').deleteMany({})
db.getCollection('domains').deleteMany({})
db.getCollection('events').deleteMany({})
db.getCollection('actions').deleteMany({})
db.getCollection('permanenttokens').deleteMany({})

db.getCollection('domains').insertMany(domains)
db.getCollection('records').insertMany(records)
db.getCollection('events').insertMany(EVENTS)
db.getCollection('actions').insertMany(actions)
db.getCollection('permanenttokens').insertMany(permanentTokens)

print(
  'Seed OK: ' +
    domains.length +
    ' domains, ' +
    records.length +
    ' pageviews, ' +
    EVENTS.length +
    ' custom events, ' +
    actions.length +
    ' actions, ' +
    permanentTokens.length +
    ' permanent token',
)
