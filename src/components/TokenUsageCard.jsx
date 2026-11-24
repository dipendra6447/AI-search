import { useState, useEffect } from 'react'

/**
 * Calculates the next 00:00:00 UTC reset date/time and relative countdown
 */
export function getDailyResetInfo() {
  const now = new Date()
  const nextReset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  )
  const diffMs = Math.max(0, nextReset.getTime() - now.getTime())
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  const isToday = nextReset.toDateString() === now.toDateString()
  const dayPrefix = isToday ? 'Today' : 'Tomorrow'

  const formattedTime = nextReset.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })

  const formattedFullDate = nextReset.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  let tz = ''
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone.replace('_', ' ')
  } catch {
    tz = 'Local Time'
  }

  return {
    nextResetDate: `${dayPrefix}, ${formattedTime}`,
    fullDateString: `${formattedFullDate} at ${formattedTime}`,
    countdown: `${hours}h ${minutes}m`,
    hours,
    minutes,
    timeZone: tz
  }
}

export default function TokenUsageCard({ tokenStats, onResetStats }) {
  const [resetInfo, setResetInfo] = useState(getDailyResetInfo)
  const [showDetails, setShowDetails] = useState(false)

  // Update countdown every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setResetInfo(getDailyResetInfo())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const {
    totalTokens = 0,
    promptTokens = 0,
    completionTokens = 0,
    lastTokens = 0,
    lastPromptTokens = 0,
    lastCompletionTokens = 0,
    queryCount = 0
  } = tokenStats || {}

  // Groq Free Tier TPM limit is 8,000 tokens/minute
  const GROQ_TPM_LIMIT = 8000
  const minuteProgress = Math.min(100, Math.round((lastTokens / GROQ_TPM_LIMIT) * 100))

  return (
    <div className='my-3 p-3 rounded-2xl bg-zinc-800/80 border border-zinc-700/70 shadow-lg text-left backdrop-blur-sm'>
      {/* Top Header */}
      <div className='flex items-center justify-between mb-2.5'>
        <div className='flex items-center gap-1.5'>
          <span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse'></span>
          <span className='text-[11px] uppercase font-bold tracking-wider text-zinc-300'>
            Token Usage
          </span>
        </div>
        <span className='px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/20'>
          Groq LPU
        </span>
      </div>

      {/* Main Metric: Total Tokens */}
      <div className='mb-2.5 bg-zinc-900/70 p-2.5 rounded-xl border border-zinc-800/80'>
        <div className='flex items-baseline justify-between'>
          <span className='text-xl sm:text-2xl font-extrabold text-white tracking-tight'>
            {totalTokens.toLocaleString()}
          </span>
          <span className='text-[10px] text-zinc-400'>
            {queryCount} {queryCount === 1 ? 'call' : 'calls'}
          </span>
        </div>
        <div className='flex items-center justify-between text-[11px] text-zinc-400 mt-1'>
          <span>Session Tokens</span>
          {lastTokens > 0 && (
            <span className='text-emerald-400 text-[10px] font-medium'>
              +{lastTokens} last call
            </span>
          )}
        </div>

        {/* Breakdown Badges */}
        <div className='grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-zinc-800 text-[10px]'>
          <div className='flex items-center justify-between bg-zinc-800/60 px-2 py-1 rounded-lg'>
            <span className='text-zinc-400'>Input:</span>
            <span className='font-mono font-medium text-sky-400'>
              {promptTokens.toLocaleString()}
            </span>
          </div>
          <div className='flex items-center justify-between bg-zinc-800/60 px-2 py-1 rounded-lg'>
            <span className='text-zinc-400'>Output:</span>
            <span className='font-mono font-medium text-amber-400'>
              {completionTokens.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Refresh Date Section */}
      <div className='bg-zinc-900/70 p-2.5 rounded-xl border border-zinc-800/80 space-y-1.5 text-[11px]'>
        <div className='flex items-center justify-between text-zinc-300'>
          <div className='flex items-center gap-1.5 font-medium'>
            <svg
              className='w-3.5 h-3.5 text-orange-400 shrink-0'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
              />
            </svg>
            <span className='text-zinc-200'>Refresh Date:</span>
          </div>
          <span className='text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-orange-400 border border-zinc-700/80'>
            in {resetInfo.countdown}
          </span>
        </div>

        <div className='pl-5 text-[11px] text-zinc-300 font-semibold'>
          {resetInfo.fullDateString}
        </div>

        <div className='pl-5 text-[10px] text-zinc-400 flex items-center justify-between'>
          <span>Daily 00:00 UTC Reset</span>
          <span className='text-zinc-500 truncate max-w-[110px]' title={resetInfo.timeZone}>
            {resetInfo.timeZone}
          </span>
        </div>

        {/* Rolling Refresh Notice */}
        <div className='pt-1.5 mt-1 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400'>
          <span className='flex items-center gap-1'>
            <svg
              className='w-3 h-3 text-sky-400 shrink-0'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
              />
            </svg>
            <span>Rolling Reset:</span>
          </span>
          <span className='text-sky-300 font-medium'>Every 60s (8k TPM)</span>
        </div>
      </div>

      {/* Expandable Quotas Info */}
      <div className='mt-2 flex items-center justify-between text-[10px] text-zinc-400'>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className='hover:text-zinc-200 transition-colors flex items-center gap-1 cursor-pointer'
        >
          <span>{showDetails ? '▲ Hide limits' : '▼ View rate limits'}</span>
        </button>

        {totalTokens > 0 && onResetStats && (
          <button
            onClick={onResetStats}
            className='text-zinc-500 hover:text-red-400 transition-colors cursor-pointer'
            title='Reset token counter'
          >
            Reset
          </button>
        )}
      </div>

      {showDetails && (
        <div className='mt-2 pt-2 border-t border-zinc-800/80 text-[10px] space-y-1.5 text-zinc-400 bg-zinc-900/50 p-2 rounded-lg'>
          <div className='flex justify-between'>
            <span>Tokens / min (TPM):</span>
            <span className='text-zinc-200 font-mono'>8,000</span>
          </div>
          <div className='flex justify-between'>
            <span>Requests / day (RPD):</span>
            <span className='text-zinc-200 font-mono'>1,000</span>
          </div>
          <div className='flex justify-between'>
            <span>Model:</span>
            <span className='text-zinc-200 truncate max-w-[120px] font-mono'>openai/gpt-oss-120b</span>
          </div>
          <div className='text-[9px] text-zinc-400 pt-1 leading-normal'>
            Tokens replenish automatically every 60 seconds; daily request limits refresh every night at 00:00 UTC.
          </div>
        </div>
      )}
    </div>
  )
}
