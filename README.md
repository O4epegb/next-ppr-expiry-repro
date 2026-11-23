# Next.js PPR after cache expiry on Vercel

On a fresh Vercel Hobby project, the first request to an expired, partially prerendered route returned its original build timestamp. The same app under `next start` generated a fresh timestamp for that request. Both servers had already served a newer cached copy before the idle interval.

Does Vercel intentionally serve the build fallback in this case? The Next.js documentation describes synchronous regeneration on the first request after expiry. [Next.js cacheLife documentation](https://nextjs.org/docs/app/api-reference/functions/cacheLife#expire)

## The two routes

Both routes use `'use cache'` with `stale: 30` and `revalidate: 60`. Only `expire` differs. Each page displays a cached timestamp and a request timestamp. The latter is rendered under Suspense after `await connection()`. The build log records the original cached timestamp for each route. [Probe implementation](app/cache-probe/CacheProbe.jsx)

- [Five-minute probe](https://next-ppr-expiry-repro.vercel.app/cache-probe/5m) uses `expire: 300`.
- [Ten-minute probe](https://next-ppr-expiry-repro.vercel.app/cache-probe/10m) uses `expire: 600`.

## Observed on November 23, 2026

Both environments ran Next.js 16.4.6, React 19.2.8 and Node 26.13.1. The only Next.js configuration was `cacheComponents: true`. Both builds reported partially prerendered routes with one-minute revalidation and the expected expiries.

| First GET after idle | Local, 5m expiry | Vercel, 5m expiry | Local, 10m expiry | Vercel, 10m expiry |
| --- | --- | --- | --- | --- |
| 6m 5s | Fresh timestamp | Build timestamp · `PRERENDER` | Previous runtime timestamp | Previous runtime timestamp · `STALE` |
| 11m 5s | Fresh timestamp | Build timestamp · `PRERENDER` | Fresh timestamp | Build timestamp · `PRERENDER` |

For example, the five-minute route built at `13:28:41.259Z`. Vercel then served `13:31:16.649Z` with a `HIT`. The first GET after the six-minute gap returned `13:28:41.259Z` again (request `rdmqb-1795441044434-abd2a00c2440`). The follow-up returned the newly generated timestamp. All 12 Vercel GETs matched request logs in region `cdg1`, with no intervening requests to either route. [Recorded timestamps, cache statuses and request IDs](observations.csv)

## Reproduce

Use Node 26.13.1 to match the recorded run. Build and start the app locally.

```sh
npm ci
npm run build
npm start
```

For the hosted comparison, deploy the same checkout to a fresh Vercel project using the Next.js preset. Use a deployment that you control for the timed experiment, since other visitors can refresh the public demo. Compare the **cached content** timestamp with the timestamp recorded in that deployment's build log.

In a second terminal, use this function to make an ordinary GET to each page. It prints both timestamps and any Vercel cache headers.

```sh
probe() {
  for route in 5m 10m; do
    echo "$route"
    curl -fsSi "$1/cache-probe/$route" | grep -Eio '^x-vercel-(cache|id):.*|<time[^>]*>'
  done
}
probe http://localhost:3000
```

1. Run `probe` against each host. Once at least 60 seconds have passed since the build, request the routes and check again a few seconds later. Start timing only once **both routes on each host** serve timestamps newer than their build timestamps. On Vercel, confirm a `HIT` for each.
2. Leave both routes idle for 365 seconds. Run `probe` once per host and save those first responses.
3. A few seconds later, confirm that each route serves a timestamp newer than the copy it had before step 2. Start a new idle interval of 665 seconds.
4. Run `probe` once per host. Record those first responses, then check again a few seconds later to observe the regenerated copies.
