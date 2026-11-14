#!/usr/bin/env python3
"""Deterministic fixture verification for the Ackee tester-env stack.

Invoked by `./tester-env verify`. It exercises the same authenticated GraphQL
API the UI uses (Time-Zone: UTC, so day buckets match the seed) and asserts the
counts produced by `tester-env-seed.js`:

    ./tester-env verify
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

JOURNAL = 'https://journal.northstar.example'
STORE = 'https://shop.northstar.example'
DOCS = 'https://docs.northstar.example'
GOOGLE = 'https://www.google.com/'
TWITTER = 'https://twitter.com/'
HACKER_NEWS = 'https://news.ycombinator.com/'
NEWSLETTER = 'https://mail.northstar.example/issue-14'

DOMAIN_IDS = {
    'Harbor Store': '6f1d6a2c-1f4e-4c3a-9b21-5f7a0e2d3c02',
    'Northstar Docs': '6f1d6a2c-1f4e-4c3a-9b21-5f7a0e2d3c03',
    'Northstar Journal': '6f1d6a2c-1f4e-4c3a-9b21-5f7a0e2d3c01',
}

TOTAL_PAGEVIEWS = 137


class Failure(Exception):
    pass


def expect(condition, message):
    if not condition:
        raise Failure(message)


def expect_equal(label, actual, expected):
    if actual != expected:
        raise Failure('%s: expected %r, got %r' % (label, expected, actual))


def counts(entries):
    return {entry['value']: entry['count'] for entry in entries}


class Client:
    def __init__(self, base_url):
        self.url = base_url.rstrip('/') + '/api'
        self.token = None

    def gql(self, query, variables=None):
        payload = {'query': query}
        if variables is not None:
            payload['variables'] = variables
        request = urllib.request.Request(self.url, data=json.dumps(payload).encode())
        request.add_header('Content-Type', 'application/json')
        request.add_header('Time-Zone', 'UTC')
        if self.token is not None:
            request.add_header('Authorization', 'Bearer ' + self.token)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = json.load(response)
        except urllib.error.HTTPError as error:
            raise Failure('GraphQL HTTP %s: %s' % (error.code, error.read().decode()))
        if body.get('errors'):
            raise Failure('GraphQL errors: %s' % (body['errors'],))
        return body['data']

    def login(self, username, password):
        data = self.gql(
            'mutation($username: String!, $password: String!) { '
            'createToken(input: { username: $username, password: $password }) '
            '{ success payload { id } } }',
            {'username': username, 'password': password},
        )
        payload = (data.get('createToken') or {}).get('payload') or {}
        expect(data['createToken']['success'] is True, 'createToken was not successful')
        expect(payload.get('id'), 'createToken returned no token id')
        self.token = payload['id']
        return payload['id']

    def _statistics(self, domain_id, body, declarations, variables):
        declarations = dict(declarations)
        values = dict(variables)
        if domain_id is None:
            root = 'statistics'
            suffix = ''
        else:
            root = 'domain(id: $id) { id statistics'
            suffix = ' }'
            declarations = {'$id': 'ID!', **declarations}
            values['id'] = domain_id
        declaration = ', '.join('%s: %s' % (name, kind) for name, kind in declarations.items())
        query = 'query(%s) { %s { id %s }%s }' % (declaration, root, body, suffix)
        data = self.gql(query, values)
        if domain_id is None:
            return data['statistics']
        return data['domain']['statistics']

    def domains(self):
        return self.gql('{ domains { id title } }')['domains']

    def facts(self):
        return self.gql(
            '{ facts { id activeVisitors averageViews { count change } '
            'averageDuration { count change } viewsToday viewsMonth viewsYear } }'
        )['facts']

    def pages(self, domain_id, range_name):
        return self._statistics(
            domain_id,
            'pages(sorting: TOP, range: $range, limit: $limit) { value count }',
            {'$range': 'Range!', '$limit': 'Int'},
            {'range': range_name, 'limit': 1000},
        )['pages']

    def referrers(self, domain_id, range_name, referrer_type='WITH_SOURCE'):
        return self._statistics(
            domain_id,
            'referrers(sorting: TOP, type: $type, range: $range, limit: $limit) { value count }',
            {'$range': 'Range!', '$type': 'ReferrerType!', '$limit': 'Int'},
            {'range': range_name, 'type': referrer_type, 'limit': 1000},
        )['referrers']

    def dimension(self, field, enum_type, range_name, dimension_type):
        return self._statistics(
            None,
            '%s(sorting: TOP, type: $type, range: $range, limit: $limit) { value count }' % field,
            {'$range': 'Range!', '$type': '%s!' % enum_type, '$limit': 'Int'},
            {'range': range_name, 'type': dimension_type, 'limit': 1000},
        )[field]

    def languages(self, range_name):
        return self._statistics(
            None,
            'languages(sorting: TOP, range: $range, limit: $limit) { value count }',
            {'$range': 'Range!', '$limit': 'Int'},
            {'range': range_name, 'limit': 1000},
        )['languages']

    def views(self, interval, view_type, limit):
        return self._statistics(
            None,
            'views(interval: $interval, type: $type, limit: $limit) { value count }',
            {'$interval': 'Interval!', '$type': 'ViewType!', '$limit': 'Int'},
            {'interval': interval, 'type': view_type, 'limit': limit},
        )['views']

    def durations(self, interval, limit):
        return self._statistics(
            None,
            'durations(interval: $interval, limit: $limit) { value count }',
            {'$interval': 'Interval!', '$limit': 'Int'},
            {'interval': interval, 'limit': limit},
        )['durations']

    def events(self):
        return self.gql('{ events { id title type } }')['events']

    def event_list(self, event_id, range_name, list_type):
        data = self.gql(
            'query($id: ID!, $range: Range!, $type: EventListType!, $limit: Int) { '
            'event(id: $id) { id statistics { id '
            'list(sorting: TOP, type: $type, range: $range, limit: $limit) { value count } } } }',
            {'id': event_id, 'range': range_name, 'type': list_type, 'limit': 100},
        )
        return data['event']['statistics']['list']

    def event_chart(self, event_id, interval, chart_type, limit):
        data = self.gql(
            'query($id: ID!, $interval: Interval!, $type: EventChartType!, $limit: Int) { '
            'event(id: $id) { id statistics { id '
            'chart(interval: $interval, type: $type, limit: $limit) { value count } } } }',
            {'id': event_id, 'interval': interval, 'type': chart_type, 'limit': limit},
        )
        return data['event']['statistics']['chart']

    def permanent_tokens(self):
        return self.gql('{ permanentTokens { id title } }')['permanentTokens']


def fetch_status(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


def main():
    parser = argparse.ArgumentParser(description='Verify deterministic Ackee fixtures')
    parser.add_argument('--base-url', default='http://localhost:8200')
    parser.add_argument('--username', default='admin')
    parser.add_argument('--password', default='tester-env-admin')
    args = parser.parse_args()

    client = Client(args.base_url)

    print('==> Verifying deterministic fixtures over GraphQL (Time-Zone: UTC)...')

    status = fetch_status(args.base_url.rstrip('/') + '/')
    expect_equal('ui status', status, 200)
    print('    ui:        / responds 200')

    token = client.login(args.username, args.password)
    print('    login:     %s -> token %s' % (args.username, token))

    # Domains -------------------------------------------------------------
    domains = client.domains()
    expect_equal('domain titles', [domain['title'] for domain in domains], list(DOMAIN_IDS))
    expect_equal(
        'domain ids',
        [domain['id'] for domain in domains],
        [DOMAIN_IDS[title] for title in DOMAIN_IDS],
    )
    print('    domains:   3 (%s)' % ', '.join(DOMAIN_IDS))

    # Facts ---------------------------------------------------------------
    facts = client.facts()
    expect_equal('facts.viewsToday', facts['viewsToday'], 14)
    expect_equal('facts.averageViews.count', facts['averageViews']['count'], 5)
    expect_equal('facts.averageViews.change', facts['averageViews']['change'], 50)
    duration = facts['averageDuration']['count']
    expect(
        180000 <= duration <= 360000,
        'facts.averageDuration.count outside 3-6 minutes: %r' % (duration,),
    )
    expect(
        facts['averageDuration']['change'] is not None,
        'facts.averageDuration.change is missing (needs both 7-day windows populated)',
    )
    expect(
        14 <= facts['viewsMonth'] <= facts['viewsYear'] <= TOTAL_PAGEVIEWS,
        'facts month/year views out of order: month=%r year=%r'
        % (facts['viewsMonth'], facts['viewsYear']),
    )
    print(
        '    facts:     viewsToday %s, averageViews %s/day (%+d%%), averageDuration %.1fs, '
        'viewsMonth %s, viewsYear %s'
        % (
            facts['viewsToday'],
            facts['averageViews']['count'],
            facts['averageViews']['change'],
            duration / 1000.0,
            facts['viewsMonth'],
            facts['viewsYear'],
        )
    )

    # Merged statistics ---------------------------------------------------
    pages_24h = counts(client.pages(None, 'LAST_24_HOURS'))
    expect_equal(
        'merged 24h pages',
        pages_24h,
        {
            JOURNAL + '/': 2,
            JOURNAL + '/essays/field-notes': 2,
            STORE + '/products/anchor-lamp': 2,
            STORE + '/': 1,
            JOURNAL + '/archive': 1,
            JOURNAL + '/essays/tide-tables': 1,
            JOURNAL + '/about': 1,
            JOURNAL + '/pricing': 1,
            JOURNAL + '/newsletter': 1,
            STORE + '/checkout': 1,
            STORE + '/products/tide-clock': 1,
        },
    )

    referrers_24h = counts(client.referrers(None, 'LAST_24_HOURS'))
    expect_equal(
        'merged 24h referrers',
        referrers_24h,
        {GOOGLE: 6, NEWSLETTER: 1, TWITTER: 1, HACKER_NEWS: 1},
    )

    systems_24h = counts(client.dimension('systems', 'SystemType', 'LAST_24_HOURS', 'WITH_VERSION'))
    expect_equal(
        'merged 24h systems',
        systems_24h,
        {
            'Windows 11': 6,
            'macOS 14.5': 2,
            'macOS 15.1': 2,
            'Ubuntu 24.04': 1,
            'Android 14': 1,
            'iOS 17.5': 1,
            'iOS 18.1': 1,
        },
    )

    devices_24h = counts(client.dimension('devices', 'DeviceType', 'LAST_24_HOURS', 'WITH_MODEL'))
    expect_equal(
        'merged 24h devices',
        devices_24h,
        {
            'Lenovo ThinkPad T14': 3,
            'Apple MacBook Air': 2,
            'Dell XPS 13': 2,
            'Apple MacBook Pro': 2,
            'Microsoft Surface Laptop 5': 2,
            'Apple iPhone 15': 1,
            'Apple iPhone 14': 1,
            'Google Pixel 8': 1,
        },
    )

    browsers_24h = counts(client.dimension('browsers', 'BrowserType', 'LAST_24_HOURS', 'WITH_VERSION'))
    expect_equal(
        'merged 24h browsers',
        browsers_24h,
        {
            'Chrome 127.0': 5,
            'Safari 17.5': 2,
            'Safari 18.1': 2,
            'Edge 127.0': 2,
            'Mobile Safari 18.1': 1,
            'Mobile Safari 17.5': 1,
            'Firefox 128.0': 1,
        },
    )

    sizes_24h = counts(client.dimension('sizes', 'SizeType', 'LAST_24_HOURS', 'BROWSER_RESOLUTION'))
    expect_equal(
        'merged 24h sizes',
        sizes_24h,
        {
            '1536px x 864px': 2,
            '1470px x 860px': 2,
            '1512px x 945px': 2,
            '1920px x 1080px': 2,
            '1600px x 960px': 2,
            '390px x 664px': 2,
            '412px x 823px': 1,
            '1440px x 900px': 1,
        },
    )

    languages_24h = counts(client.languages('LAST_24_HOURS'))
    expect_equal(
        'merged 24h languages',
        languages_24h,
        {'English': 9, 'German': 2, 'Dutch / Flemish': 1, 'Spanish / Castilian': 1, 'French': 1},
    )
    print(
        '    24h:       pages %d across %d, referrers %d, systems %d, devices %d, browsers %d, '
        'sizes %d, languages %d'
        % (
            sum(pages_24h.values()),
            len(pages_24h),
            len(referrers_24h),
            len(systems_24h),
            len(devices_24h),
            len(browsers_24h),
            len(sizes_24h),
            len(languages_24h),
        )
    )

    pages_7d = counts(client.pages(None, 'LAST_7_DAYS'))
    expect_equal('merged 7d pageviews', sum(pages_7d.values()), 59)
    expect_equal('merged 7d rows', len(pages_7d), 12)
    expect_equal('merged 7d top page count', pages_7d.get(JOURNAL + '/'), 8)
    expect_equal(
        'merged 7d referrers',
        counts(client.referrers(None, 'LAST_7_DAYS')),
        {GOOGLE: 12, NEWSLETTER: 9, HACKER_NEWS: 7, TWITTER: 6},
    )

    pages_30d = counts(client.pages(None, 'LAST_30_DAYS'))
    expect_equal('merged 30d pageviews', sum(pages_30d.values()), 104)
    expect_equal('merged 30d rows', len(pages_30d), 12)
    expect_equal('merged 30d top page count', pages_30d.get(JOURNAL + '/pricing'), 14)

    pages_6mo = counts(client.pages(None, 'LAST_6_MONTHS'))
    expect_equal('merged 6mo pageviews', sum(pages_6mo.values()), TOTAL_PAGEVIEWS)
    expect_equal('merged 6mo rows', len(pages_6mo), 14)
    print(
        '    ranges:    7d %d pageviews, 30d %d, 6mo %d across all domains'
        % (sum(pages_7d.values()), sum(pages_30d.values()), sum(pages_6mo.values()))
    )

    # Per-domain statistics ----------------------------------------------
    journal_24h = counts(client.pages(DOMAIN_IDS['Northstar Journal'], 'LAST_24_HOURS'))
    expect_equal(
        'journal 24h pages',
        journal_24h,
        {
            JOURNAL + '/': 2,
            JOURNAL + '/essays/field-notes': 2,
            JOURNAL + '/essays/tide-tables': 1,
            JOURNAL + '/archive': 1,
            JOURNAL + '/about': 1,
            JOURNAL + '/pricing': 1,
            JOURNAL + '/newsletter': 1,
        },
    )
    expect_equal(
        'journal 7d pageviews',
        sum(counts(client.pages(DOMAIN_IDS['Northstar Journal'], 'LAST_7_DAYS')).values()),
        44,
    )
    expect_equal(
        'journal 24h referrers',
        counts(client.referrers(DOMAIN_IDS['Northstar Journal'], 'LAST_24_HOURS')),
        {GOOGLE: 4, TWITTER: 1, HACKER_NEWS: 1},
    )

    store_24h = counts(client.pages(DOMAIN_IDS['Harbor Store'], 'LAST_24_HOURS'))
    expect_equal(
        'store 24h pages',
        store_24h,
        {
            STORE + '/products/anchor-lamp': 2,
            STORE + '/': 1,
            STORE + '/products/tide-clock': 1,
            STORE + '/checkout': 1,
        },
    )

    docs_7d = client.pages(DOMAIN_IDS['Northstar Docs'], 'LAST_7_DAYS')
    expect_equal('docs 7d pages (idle domain)', docs_7d, [])
    docs_6mo = counts(client.pages(DOMAIN_IDS['Northstar Docs'], 'LAST_6_MONTHS'))
    expect_equal('docs 6mo pages', docs_6mo, {DOCS + '/docs/intro': 5, DOCS + '/docs/api': 5})
    print(
        '    domains:   journal 24h %d / 7d 44, store 24h %d, docs 7d empty / 6mo %d'
        % (sum(journal_24h.values()), sum(store_24h.values()), sum(docs_6mo.values()))
    )

    # Views and durations (daily chart) ----------------------------------
    views = [entry['count'] for entry in client.views('DAILY', 'UNIQUE', 15)]
    expect_equal('views today (daily chart index 0)', views[0], 14)
    expect_equal('views today (facts)', facts['viewsToday'], views[0])
    expect(
        sum(1 for value in views if value > 0) >= 12,
        'daily views chart has fewer than 12 populated days: %r' % (views,),
    )
    durations = [entry['count'] for entry in client.durations('DAILY', 15)]
    expect(
        sum(1 for value in durations if value > 0) >= 12,
        'daily durations chart has fewer than 12 populated days: %r' % (durations,),
    )
    print(
        '    charts:    14-day daily views %r, durations populated on %d days'
        % (views, sum(1 for value in durations if value > 0))
    )

    # Custom events and actions ------------------------------------------
    events = {event['title']: event for event in client.events()}
    expect_equal(
        'event titles/types',
        {title: event['type'] for title, event in events.items()},
        {
            'Newsletter signup': 'TOTAL_LIST',
            'Checkout completed': 'TOTAL_CHART',
            'Reading time': 'AVERAGE_CHART',
            'Article rating': 'AVERAGE_LIST',
        },
    )

    signups = counts(client.event_list(events['Newsletter signup']['id'], 'LAST_24_HOURS', 'TOTAL'))
    expect_equal('newsletter signup 24h list', signups, {'header': 3, 'footer': 2, 'article': 1})
    expect_equal(
        'newsletter signup 7d list',
        counts(client.event_list(events['Newsletter signup']['id'], 'LAST_7_DAYS', 'TOTAL')),
        {'header': 6, 'footer': 4, 'article': 3},
    )

    checkout = [entry['count'] for entry in client.event_chart(events['Checkout completed']['id'], 'DAILY', 'TOTAL', 7)]
    expect_equal('checkout 7-day chart', checkout, [267, 59, 99, 149, 0, 89, 0])

    ratings = counts(client.event_list(events['Article rating']['id'], 'LAST_24_HOURS', 'AVERAGE'))
    expect_equal('article rating 24h list', ratings, {'field-notes': 5, 'tide-tables': 4})

    reading = [entry['count'] for entry in client.event_chart(events['Reading time']['id'], 'DAILY', 'AVERAGE', 7)]
    expect(
        abs(reading[0] - 171.6667) < 0.5,
        'reading time today average unexpected: %r' % (reading[0],),
    )
    print(
        '    events:    4 (signup 24h %r, checkout 7d %r, rating 24h %r)'
        % (signups, checkout, ratings)
    )

    # Settings ------------------------------------------------------------
    permanent_tokens = client.permanent_tokens()
    expect_equal(
        'permanent token titles',
        [token_entry['title'] for token_entry in permanent_tokens],
        ['Newsletter relay'],
    )
    print('    settings:  1 permanent token (%s)' % permanent_tokens[0]['title'])

    print(
        'Verify OK: 3 domains, %d pageviews, 14 views today, 4 custom events, 39 actions, '
        '1 permanent token' % TOTAL_PAGEVIEWS
    )


if __name__ == '__main__':
    try:
        main()
    except Failure as error:
        print('Error: %s' % (error,), file=sys.stderr)
        sys.exit(1)
