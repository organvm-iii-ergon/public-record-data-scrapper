# Browser runtime configuration

The CA Puppeteer scraper and NY Playwright scraper both require a real Chromium
executable in production. CI installs dependencies with `npm ci --ignore-scripts`,
so browser downloads from package lifecycle scripts must not be assumed.

## Runtime contract

Set one of these environment variables to an absolute, executable, nonempty
Chromium binary:

```sh
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# or
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
```

If both are set, they must point to the same file. Conflicting aliases fail fast
before a scraper launches so Puppeteer and Playwright cannot silently use
different browser binaries.

In production, leaving both variables unset is an error. In development and test,
leaving them unset preserves the automation library defaults.

## CI proof

The CI Gate provisions an offline Chromium fixture during scraper/build checks
with:

```sh
node scripts/provision-browser-runtime.mjs
```

The scraper lane then runs:

```sh
npm run test:browser-runtime
```

That smoke test opens only a local `data:` URL through Puppeteer,
`puppeteer-extra` with stealth, and Playwright. It does not download browsers and
does not contact public-record portals.
