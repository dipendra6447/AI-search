import './globals.css'

export const metadata = {
  title: 'AI Search - Ultra-Fast LPU Inference',
  description: 'AI Search powered by GroqCloud LPU (openai/gpt-oss-120b)',
}

export default function RootLayout({ children }) {
  return (
    <html lang='en' className='dark'>
      <body className='bg-zinc-950 text-white antialiased'>{children}</body>
    </html>
  )
}
