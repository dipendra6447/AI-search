import { useState } from 'react'
import { parseMarkdownBlocks } from '../lib/Helper'

function CodeCard({ code, lang }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = code
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  return (
    <div className='my-3 sm:my-4 rounded-xl border border-zinc-700/80 bg-zinc-950 overflow-hidden shadow-xl text-left max-w-full'>
      {/* Code Card Top Bar */}
      <div className='flex items-center justify-between px-3 sm:px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-[11px] sm:text-xs text-zinc-400 select-none'>
        <div className='flex items-center gap-1.5 sm:gap-2 font-mono'>
          <span className='w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-red-500/80 inline-block'></span>
          <span className='w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-amber-500/80 inline-block'></span>
          <span className='w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-emerald-500/80 inline-block'></span>
          <span className='ml-1.5 sm:ml-2 uppercase tracking-wider text-zinc-300 font-semibold text-[10px] sm:text-[11px]'>
            {lang || 'code'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className='flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer text-[11px] sm:text-xs'
          title='Copy code'
        >
          {copied ? (
            <>
              <svg className='w-3 sm:w-3.5 h-3 sm:h-3.5 text-emerald-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2.5' d='M5 13l4 4L19 7' />
              </svg>
              <span className='text-emerald-400 font-medium'>Copied!</span>
            </>
          ) : (
            <>
              <svg className='w-3 sm:w-3.5 h-3 sm:h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Block Content */}
      <div className='p-3 sm:p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed text-emerald-300/90 selection:bg-zinc-800'>
        <pre className='m-0 p-0 font-mono'>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}

function FormattedInline({ text }) {
  if (!text) return null

  // Match inline `code` and **bold**
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          return (
            <code
              key={index}
              className='px-1 sm:px-1.5 py-0.5 mx-0.5 rounded-md bg-zinc-800 border border-zinc-700/80 text-amber-300 font-mono text-[11px] sm:text-xs'
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return (
            <strong key={index} className='font-bold text-white'>
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

export default function Answers({ content, ans, isTyping }) {
  const rawText = content || ans || ''
  if (!rawText) return null

  const blocks = parseMarkdownBlocks(rawText)

  return (
    <div className='space-y-2.5 sm:space-y-3 text-zinc-200 text-left text-sm sm:text-base leading-relaxed'>
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return <CodeCard key={index} code={block.code} lang={block.lang} />
        }

        if (block.type === 'heading') {
          const headingClasses =
            block.level === 1
              ? 'text-xl sm:text-2xl font-bold mt-5 sm:mt-6 mb-2 sm:mb-3 text-white'
              : block.level === 2
              ? 'text-lg sm:text-xl font-bold mt-4 sm:mt-5 mb-2 text-white'
              : 'text-base sm:text-lg font-semibold mt-3 sm:mt-4 mb-1.5 text-white'

          return (
            <div key={index} className={headingClasses}>
              <FormattedInline text={block.text} />
            </div>
          )
        }

        if (block.type === 'bullet') {
          return (
            <div key={index} className='flex items-start gap-2 my-1 pl-1 sm:pl-2 text-zinc-200'>
              <span className='text-zinc-400 mt-1.5 text-[7px] sm:text-[8px]'>●</span>
              <div className='flex-1 leading-relaxed'>
                <FormattedInline text={block.text} />
              </div>
            </div>
          )
        }

        if (block.type === 'numbered') {
          return (
            <div key={index} className='flex items-start gap-2 my-1 pl-0.5 sm:pl-1 text-zinc-200'>
              <span className='text-blue-400 font-semibold text-xs sm:text-sm min-w-4 sm:min-w-5'>{block.number}.</span>
              <div className='flex-1 leading-relaxed'>
                <FormattedInline text={block.text} />
              </div>
            </div>
          )
        }

        // Regular paragraph
        return (
          <p key={index} className='my-1.5 leading-relaxed'>
            <FormattedInline text={block.text} />
          </p>
        )
      })}

      {isTyping && (
        <span className='inline-block w-1.5 sm:w-2 h-4 sm:h-4.5 bg-blue-400 animate-pulse align-middle ml-1 rounded-sm'></span>
      )}
    </div>
  )
}
