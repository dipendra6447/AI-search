import { useState, useEffect, useRef } from 'react'
import './App.css'
import { GROQ_API_KEY, GROQ_ENDPOINT, GROQ_MODEL } from './constants'
import Answers from './components/Answers'
import TokenUsageCard from './components/TokenUsageCard'

const SESSION_STORAGE_KEY = 'ai_search_session_messages'
const TOKEN_STORAGE_KEY = 'ai_search_token_usage'

function App() {
  const [question, setQuestion] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)

  // Load initial session history from sessionStorage
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      console.error('Failed to parse session storage:', e)
      return []
    }
  })

  const [streamingAnswer, setStreamingAnswer] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [showLoader, setShowLoader] = useState(false)
  const [loaderText, setLoaderText] = useState('Thinking...')
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)

  // Track session token statistics
  const [tokenStats, setTokenStats] = useState(() => {
    try {
      const saved = sessionStorage.getItem(TOKEN_STORAGE_KEY)
      return saved
        ? JSON.parse(saved)
        : {
            totalTokens: 0,
            promptTokens: 0,
            completionTokens: 0,
            lastTokens: 0,
            lastPromptTokens: 0,
            lastCompletionTokens: 0,
            queryCount: 0
          }
    } catch {
      return {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        lastTokens: 0,
        lastPromptTokens: 0,
        lastCompletionTokens: 0,
        queryCount: 0
      }
    }
  })

  // Persist token usage to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenStats))
    } catch (e) {
      console.error('Failed to save token stats:', e)
    }
  }, [tokenStats])

  // Record tokens from Groq API response
  const recordTokenUsage = (usage) => {
    if (!usage) return
    const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = usage
    setTokenStats((prev) => ({
      totalTokens: (prev?.totalTokens || 0) + total_tokens,
      promptTokens: (prev?.promptTokens || 0) + prompt_tokens,
      completionTokens: (prev?.completionTokens || 0) + completion_tokens,
      lastTokens: total_tokens,
      lastPromptTokens: prompt_tokens,
      lastCompletionTokens: completion_tokens,
      queryCount: (prev?.queryCount || 0) + 1
    }))
  }

  // Clear/reset token statistics
  const resetTokenStats = () => {
    const cleanStats = {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      lastTokens: 0,
      lastPromptTokens: 0,
      lastCompletionTokens: 0,
      queryCount: 0
    }
    setTokenStats(cleanStats)
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(cleanStats))
    } catch (e) {
      console.error('Failed to clear token stats:', e)
    }
  }

  // Persist messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages))
    } catch (e) {
      console.error('Failed to save to session storage:', e)
    }
  }, [messages])

  // Word-by-word typewriter streaming effect for text answers
  useEffect(() => {
    if (!streamingAnswer?.fullText) return

    const fullText = streamingAnswer.fullText
    const tokens = fullText.match(/\S+|\s+/g) || [fullText]
    let currentIndex = 0
    setIsTyping(true)

    const step = tokens.length > 300 ? 3 : tokens.length > 150 ? 2 : 1
    const intervalMs = 20

    const timer = setInterval(() => {
      currentIndex += step
      if (currentIndex >= tokens.length) {
        setMessages((prev) => [
          ...prev,
          { id: streamingAnswer.id, role: 'assistant', text: fullText }
        ])
        setStreamingAnswer(null)
        setIsTyping(false)
        clearInterval(timer)
      } else {
        setStreamingAnswer((prev) =>
          prev
            ? {
                ...prev,
                displayedText: tokens.slice(0, currentIndex).join('')
              }
            : null
        )
      }
    }, intervalMs)

    return () => clearInterval(timer)
  }, [streamingAnswer?.fullText])

  // Auto-scroll as messages are added or words are typed
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, streamingAnswer?.displayedText, showLoader])

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowNewSessionModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Skip animation to display full answer immediately
  const skipTyping = () => {
    if (isTyping && streamingAnswer) {
      setMessages((prev) => [
        ...prev,
        { id: streamingAnswer.id, role: 'assistant', text: streamingAnswer.fullText }
      ])
      setStreamingAnswer(null)
      setIsTyping(false)
    }
  }

  // Request to start a new session
  const requestNewSession = () => {
    if (messages.length === 0) {
      setQuestion('')
      setError('')
      setSidebarOpen(false)
      return
    }
    setShowNewSessionModal(true)
  }

  // Confirmed clearing of current session
  const confirmNewSession = () => {
    setMessages([])
    setStreamingAnswer(null)
    setIsTyping(false)
    setError('')
    setQuestion('')
    setSidebarOpen(false)
    setShowNewSessionModal(false)
    resetTokenStats()
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    } catch (e) {
      console.error('Failed to clear session storage:', e)
    }
  }

  // Submit query: handles Text Search via GroqCloud LPU
  const askQuestion = async (queryText) => {
    const trimmedQuestion = (typeof queryText === 'string' ? queryText : question).trim()
    if (!trimmedQuestion || showLoader || isTyping) return

    setShowLoader(true)
    setError('')
    setQuestion('')
    setSidebarOpen(false)

    // Append user message
    const userMsgId = Date.now()
    const newUserMsg = {
      id: userMsgId,
      role: 'user',
      text: trimmedQuestion
    }
    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)

    setLoaderText('Thinking on Groq LPU...')

    // Build chat message history for GroqCloud API
    const chatMessages = [
      {
        role: 'system',
        content:
          'You are an intelligent, ultra-fast AI assistant powered by GroqCloud. Provide clear, accurate, and well-structured answers using Markdown headings, bullet points, and code blocks where applicable.'
      },
      ...updatedMessages.map((msg) => ({
        role: msg.role === 'model' || msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.text
      }))
    ]

    const payload = {
      model: GROQ_MODEL,
      messages: chatMessages
    }

    try {
      const response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error?.message || `Request failed with status ${response.status}`)
      }

      if (data?.usage) {
        recordTokenUsage(data.usage)
      }

      const answerText = data?.choices?.[0]?.message?.content
      if (!answerText) {
        throw new Error('No answer received from the AI model.')
      }

      setStreamingAnswer({
        id: Date.now() + 1,
        fullText: answerText,
        displayedText: ''
      })
    } catch (err) {
      console.error('Search error:', err)
      setError(err.message || 'An error occurred while fetching the response.')
    } finally {
      setShowLoader(false)
    }
  }

  const scrollToMessage = (msgId) => {
    setSidebarOpen(false)
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const userSearches = messages.filter((m) => m.role === 'user')

  return (
    <>
      <div className='flex h-screen h-[100dvh] bg-zinc-950 text-white overflow-hidden relative'>
        {/* Mobile Backdrop Overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className='fixed inset-0 bg-black/70 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300'
          />
        )}

        {/* Responsive Sidebar */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-50 w-72 sm:w-80 md:w-64 lg:w-72 bg-zinc-900 border-r border-zinc-800/80 p-4 sm:p-5 flex flex-col justify-between shrink-0 shadow-2xl md:shadow-none transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <div className='flex flex-col h-full overflow-hidden'>
            {/* Sidebar Header */}
            <div className='mb-4'>
              <div className='flex items-center justify-between mb-1'>
                <h1 className='text-lg font-bold text-white flex items-center gap-2'>
                  <span className='text-orange-500'>✦</span> AI Search
                </h1>
                {/* Mobile Drawer Close Button */}
                <button
                  onClick={() => setSidebarOpen(false)}
                  className='p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 md:hidden cursor-pointer'
                  aria-label='Close sidebar'
                >
                  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12' />
                  </svg>
                </button>
              </div>
              <div className='flex items-center justify-between text-[11px] text-zinc-400'>
                <span>Ultra-Fast LPU Inference</span>
                <span className='px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-medium'>
                  GroqCloud
                </span>
              </div>
            </div>

            {/* New Session Button */}
            <button
              onClick={requestNewSession}
              className='w-full py-2.5 px-3 mb-4 flex items-center justify-center gap-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-medium border border-zinc-700/60 transition-colors cursor-pointer'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 4v16m8-8H4' />
              </svg>
              <span>+ New Session</span>
            </button>

            {/* Session Searches History */}
            <div className='flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 pr-1'>
              <div className='text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-2 flex items-center justify-between'>
                <span>This Session ({userSearches.length})</span>
              </div>

              {userSearches.length === 0 ? (
                <div className='text-xs text-zinc-400 italic py-6 text-center'>
                  No activity in this session yet.
                </div>
              ) : (
                <ul className='space-y-1.5'>
                  {userSearches.map((msg, idx) => (
                    <li key={msg.id}>
                      <button
                        onClick={() => scrollToMessage(msg.id)}
                        className='w-full text-left p-2.5 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/90 active:bg-zinc-800 transition-colors truncate flex items-center gap-2 cursor-pointer'
                        title={msg.text}
                      >
                        <span className='text-zinc-500 text-[10px] min-w-3'>{idx + 1}.</span>
                        <span className='text-zinc-400 text-xs mr-1'>💬</span>
                        <span className='truncate'>{msg.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Token Usage & Refresh Date Card on the Left Side */}
            <div className='shrink-0 pt-2'>
              <TokenUsageCard tokenStats={tokenStats} onResetStats={resetTokenStats} />
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className='pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400'>
            <span className='truncate font-medium text-zinc-300'>Groq 120B</span>
            {messages.length > 0 && (
              <button
                onClick={requestNewSession}
                className='text-red-400 hover:text-red-300 transition-colors cursor-pointer text-[11px]'
                title='Clear session history'
              >
                Clear History
              </button>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className='flex-1 flex flex-col h-full overflow-hidden bg-zinc-900/30 relative'>
          {/* Mobile App Navigation Header */}
          <header className='md:hidden flex items-center justify-between px-3.5 py-2.5 bg-zinc-900/95 border-b border-zinc-800/80 backdrop-blur-md shrink-0 z-30'>
            <button
              onClick={() => setSidebarOpen(true)}
              className='p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 transition-colors cursor-pointer'
              aria-label='Open history menu'
            >
              <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M4 6h16M4 12h16M4 18h16' />
              </svg>
            </button>

            <div className='flex items-center gap-1.5 font-bold text-white text-base'>
              <span className='text-orange-500'>✦</span>
              <span>AI Search</span>
            </div>

            <button
              onClick={requestNewSession}
              className='p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 active:bg-zinc-700 transition-colors cursor-pointer'
              aria-label='New session'
              title='New Session'
            >
              <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 4v16m8-8H4' />
              </svg>
            </button>
          </header>

          {/* Scrollable Conversation Stream */}
          <div className='flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 scrollbar-thin scrollbar-thumb-zinc-700'>
            <div className='max-w-3xl mx-auto w-full'>
              {/* Empty State */}
              {messages.length === 0 && !showLoader && (
                <div className='text-center text-zinc-500 mt-8 sm:mt-12 px-2'>
                  <div className='text-4xl sm:text-5xl mb-3'>⚡</div>
                  <h2 className='text-xl sm:text-2xl font-semibold text-zinc-200 mb-2'>
                    GroqCloud Fast AI Search
                  </h2>
                  <p className='text-xs sm:text-sm text-zinc-400 mb-6 max-w-md mx-auto leading-relaxed'>
                    Powered by GroqCloud LPU (openai/gpt-oss-120b). Lightning-fast answers, code generation, and session memory.
                  </p>

                  {/* Suggestion Cards */}
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-lg mx-auto text-left'>
                    <button
                      onClick={() => askQuestion('Write a Python function for binary search with comments')}
                      className='p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-orange-500/50 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer'
                    >
                      💻 Python binary search function
                    </button>
                    <button
                      onClick={() => askQuestion('Explain how useState and useEffect work in React')}
                      className='p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-orange-500/50 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer'
                    >
                      ⚛️ Explain useState vs useEffect in React
                    </button>
                    <button
                      onClick={() => askQuestion('What are the key differences between SQL and NoSQL databases?')}
                      className='p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-orange-500/50 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer'
                    >
                      🗄️ SQL vs NoSQL database comparison
                    </button>
                    <button
                      onClick={() => askQuestion('Give me 5 practical tips to optimize web performance')}
                      className='p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/60 hover:border-orange-500/50 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer'
                    >
                      ⚡ 5 tips to optimize web performance
                    </button>
                  </div>
                </div>
              )}

              {/* Session Messages Thread */}
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className='flex items-start gap-2.5 sm:gap-3 my-3 sm:my-4 p-3.5 sm:p-4 rounded-2xl bg-zinc-800/70 border border-zinc-700/60 shadow-md max-w-full'
                    >
                      <div className='w-6 h-6 sm:w-7 sm:h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 bg-orange-500/30 text-orange-400'>
                        Q
                      </div>
                      <div className='text-white font-medium text-sm sm:text-base pt-0.5 leading-relaxed break-words flex-1'>
                        {msg.text}
                      </div>
                    </div>
                  )
                }

                // AI Text Response
                return (
                  <div
                    key={msg.id}
                    className='p-4 sm:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl my-3 sm:my-4 max-w-full overflow-hidden'
                  >
                    <div className='flex items-center justify-between mb-3 pb-2.5 border-b border-zinc-800 text-xs text-zinc-400'>
                      <div className='flex items-center gap-1.5 font-semibold text-zinc-300 text-xs sm:text-sm'>
                        <span className='text-orange-400'>✦</span> Groq Response
                      </div>
                    </div>
                    <Answers content={msg.text} />
                  </div>
                )
              })}

              {/* Word-by-word streaming text response */}
              {streamingAnswer && (
                <div className='p-4 sm:p-6 rounded-2xl bg-zinc-900/90 border border-orange-500/30 shadow-2xl my-3 sm:my-4 max-w-full overflow-hidden'>
                  <div className='flex items-center justify-between mb-3 pb-2.5 border-b border-zinc-800 text-xs text-zinc-400'>
                    <div className='flex items-center gap-1.5 font-semibold text-zinc-300 text-xs sm:text-sm'>
                      <span className='text-orange-400'>✦</span> Generating response...
                    </div>
                    <button
                      onClick={skipTyping}
                      className='text-[11px] sm:text-xs text-zinc-400 hover:text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer'
                    >
                      Skip ⏭
                    </button>
                  </div>
                  <Answers content={streamingAnswer.displayedText} isTyping={true} />
                </div>
              )}

              {/* Loader */}
              {showLoader && (
                <div className='flex items-center gap-3 my-4 p-4 rounded-xl border animate-pulse bg-zinc-900/70 border-zinc-800 text-zinc-400'>
                  <div className='w-2.5 h-2.5 rounded-full animate-bounce bg-orange-400'></div>
                  <div className='w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:0.2s] bg-orange-400'></div>
                  <div className='w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:0.4s] bg-orange-400'></div>
                  <span className='text-xs sm:text-sm font-medium ml-1'>{loaderText}</span>
                </div>
              )}

              {/* Error Alert */}
              {error && (
                <div className='p-3.5 sm:p-4 my-3 sm:my-4 bg-red-950/70 border border-red-800 text-red-200 rounded-xl text-xs sm:text-sm'>
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Area: Input Bar */}
          <footer className='p-2 sm:p-4 bg-zinc-950/90 sm:bg-transparent backdrop-blur-md border-t border-zinc-800/60 sm:border-t-0 shrink-0'>
            <div className='bg-zinc-800/95 w-full max-w-2xl mx-auto rounded-3xl sm:rounded-4xl border border-zinc-700/80 focus-within:border-orange-500 text-white flex items-center shadow-2xl transition-colors p-1 sm:p-1.5'>
              <input
                type='text'
                placeholder={messages.length > 0 ? 'Ask follow-up question...' : 'Ask me anything or request code...'}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !showLoader && !isTyping && askQuestion()}
                className='flex-1 border-none outline-none bg-transparent text-sm sm:text-base px-3 sm:px-4 py-2 text-white placeholder:text-zinc-500 min-w-0'
              />
              <button
                className='w-9 h-9 sm:w-auto sm:px-5 sm:py-2.5 disabled:opacity-40 disabled:cursor-not-allowed rounded-full sm:rounded-3xl cursor-pointer text-sm font-medium transition-colors shrink-0 flex items-center justify-center gap-1.5 text-white bg-orange-600 hover:bg-orange-500'
                onClick={() => askQuestion()}
                disabled={showLoader || isTyping || !question.trim()}
                aria-label='Send query'
              >
                <svg className='w-4 h-4 sm:hidden' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2.5' d='M5 12h14M12 5l7 7-7 7' />
                </svg>
                <span className='hidden sm:inline'>Ask</span>
              </button>
            </div>
          </footer>
        </div>

        {/* Custom Confirmation Popup Modal for New Session */}
        {showNewSessionModal && (
          <div
            className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs'
            onClick={() => setShowNewSessionModal(false)}
            role='dialog'
            aria-modal='true'
            aria-labelledby='new-session-title'
          >
            <div
              className='bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center transform transition-all'
              onClick={(e) => e.stopPropagation()}
            >
              <div className='w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto mb-4 shadow-inner'>
                <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 4v16m8-8H4' />
                </svg>
              </div>

              <h3 id='new-session-title' className='text-lg font-bold text-white mb-2'>
                Start a New Session?
              </h3>
              <p className='text-xs sm:text-sm text-zinc-400 mb-6 leading-relaxed'>
                This will clear your current conversation history and code.
              </p>

              <div className='flex items-center gap-3'>
                <button
                  type='button'
                  onClick={() => setShowNewSessionModal(false)}
                  className='flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer border border-zinc-700/60'
                >
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={confirmNewSession}
                  className='flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-orange-600/20'
                >
                  New Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default App
