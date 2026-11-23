import { cacheLife } from 'next/cache'
import { connection } from 'next/server'
import { Suspense } from 'react'

async function getCachedTimestamp(expiryMinutes) {
  'use cache'

  cacheLife({ stale: 30, revalidate: 60, expire: expiryMinutes * 60 })
  const generatedAt = new Date().toISOString()
  console.info(`[cache-probe/${expiryMinutes}m] generated ${generatedAt} (Node ${process.version})`)
  return generatedAt
}

async function RequestTimestamp() {
  await connection()
  const renderedAt = new Date().toISOString()
  return <time id="request-at" dateTime={renderedAt}>{renderedAt}</time>
}

export default async function CacheProbe({ expiryMinutes }) {
  const generatedAt = await getCachedTimestamp(expiryMinutes)
  return (
    <main>
      <h1>Cache expiry probe · {expiryMinutes} minutes</h1>
      <dl>
        <dt>Cached content generated at (UTC)</dt>
        <dd><time id="cached-at" dateTime={generatedAt}>{generatedAt}</time></dd>
        <dt>Request rendered at (UTC)</dt>
        <dd><Suspense fallback={null}><RequestTimestamp /></Suspense></dd>
      </dl>
    </main>
  )
}
