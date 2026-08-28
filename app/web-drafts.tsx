'use client'

import { useEffect, useState } from 'react'
import App from '../src/App'
import { installWebApi } from '../src/web/webApi'

export default function WebDrafts() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    installWebApi()
    setReady(true)
  }, [])

  if (!ready) {
    return <main className="h-screen grid place-items-center">Opening your writing desk…</main>
  }

  return <App />
}
