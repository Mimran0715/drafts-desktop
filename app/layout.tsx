import type { Metadata } from 'next'
import '../src/globals.css'

export const metadata: Metadata = {
  title: 'Drafts — AI writing desk',
  description: 'A focused writing desk with an AI collaborator.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
