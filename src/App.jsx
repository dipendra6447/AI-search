import { useState, useEffect, useRef } from 'react'
import './App.css'
import { API_URL } from './constants'
import Answers from './components/Answers'

const SESSION_STORAGE_KEY = 'ai_search_session_messages'

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
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)

  // Persist messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages))
    } catch (e) {
      console.error('Failed to save to session storage:', e)
    }
  }, [messages])

  // Word-by-word typewriter streaming effect
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
          { id: streamingAnswer.id, role: 'model', text: fullText }
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
      if (e.key === 'Escape' && showNewSessionModal) {
        setShowNewSessionModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showNewSessionModal])

  // Skip animation to display full answer immediately
  const skipTyping = () => {
    if (isTyping && streamingAnswer) {
      setMessages((prev) => [
        ...prev,
        { id: streamingAnswer.id, role: 'model', text: streamingAnswer.fullText }
      ])
      setStreamingAnswer(null)
      setIsTyping(false)
    }
  }

  // Request to start a new session (shows HTML modal if messages exist)
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
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
    } catch (e) {
      console.error('Failed to clear session storage:', e)
    }
  }

  // Submit search query
  const askQuestion = async (queryText) => {
    const trimmedQuestion = (typeof queryText === 'string' ? queryText : question).trim()
    if (!trimmedQuestion || showLoader || isTyping) return

    setShowLoader(true)
    setError('')
    setQuestion('')
    setSidebarOpen(false)

    // Append user message
    const userMsgId = Date.now()
    const newUserMsg = { id: userMsgId, role: 'user', text: trimmedQuestion }
    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)

    // Build alternating conversational history for Gemini API
    const contentsHistory = []
    for (const msg of updatedMessages) {
      if (!msg.text || !msg.text.trim()) continue
      const role = msg.role === 'user' ? 'user' : 'model'

      if (contentsHistory.length > 0 && contentsHistory[contentsHistory.length - 1].role === role) {
        contentsHistory[contentsHistory.length - 1].parts[0].text += '\n\n' + msg.text.trim()
      } else {
        contentsHistory.push({
          role: role,
          parts: [{ text: msg.text.trim() }]
        })
      }
    }

    while (contentsHistory.length > 0 && contentsHistory[0].role !== 'user') {
      contentsHistory.shift()
    }

    const payload = {
      contents: contentsHistory
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error?.message || `Request failed with status ${response.status}`)
      }

      const answerText = data?.candidates?.[0]?.content?.parts?.[0]?.text
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

        {/* Responsive Sidebar (Slide-over on mobile, static on desktop) */}
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
                  <span className='text-blue-400'>✦</span> AI Search
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
                <span>Contextual Multi-Turn</span>
                <span className='px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]'>
                  Live Session
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
              <span>New Session</span>
            </button>

            {/* Session Searches History */}
            <div className='flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 pr-1'>
              <div className='text-[11px] uppercase tracking-wider text-zinc-400 font-semibold mb-2 flex items-center justify-between'>
                <span>This Session ({userSearches.length})</span>
              </div>

              {userSearches.length === 0 ? (
                <div className='text-xs text-zinc-400 italic py-6 text-center'>
                  No searches in this session yet.
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
                        <span className='truncate'>{msg.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className='pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400'>
            <span>Gemini 2.5 Flash</span>
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

        {/* Main Chat/Search Area */}
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
              <span className='text-blue-400'>✦</span> AI Search
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
                <div className='text-center text-zinc-500 mt-12 sm:mt-20 px-2'>
                  <div className='text-4xl sm:text-5xl mb-3 sm:mb-4'>🔍</div>
                  <h2 className='text-xl sm:text-2xl font-semibold text-zinc-200 mb-2'>
                    AI Search
                  </h2>
                  <p className='text-xs sm:text-sm text-zinc-400 mb-6 sm:mb-8 max-w-md mx-auto leading-relaxed'>
                    Search questions, generate code, or explore topics. Previous results are stored in your session!
                  </p>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-lg mx-auto text-left'>
                    <button
                      onClick={() => askQuestion('Write a Python function for binary search with comments')}
                      className='p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 active:bg-zinc-700/80 border border-zinc-700/60 hover:border-blue-500/50 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer'
                    >
                      💻 Python binary search function
                    </button>
                    <button
                      onClick={() => askQuestion('Explain how useState and useEffect work in React')}
                      className='p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 active:bg-zinc-700/80 border border-zinc-700/60 hover:border-blue-500/50 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer'
                    >
                      ⚛️ Explain useState vs useEffect in React
                    </button>
                    <button
                      onClick={() => askQuestion('What are the key differences between SQL and NoSQL databases?')}
                      className='p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 active:bg-zinc-700/80 border border-zinc-700/60 hover:border-blue-500/50 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer'
                    >
                      🗄️ SQL vs NoSQL database comparison
                    </button>
                    <button
                      onClick={() => askQuestion('Give me 5 practical tips to optimize web performance')}
                      className='p-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 active:bg-zinc-700/80 border border-zinc-700/60 hover:border-blue-500/50 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer'
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
                      <div className='w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-600/30 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5'>
                        Q
                      </div>
                      <div className='text-white font-medium text-sm sm:text-base pt-0.5 leading-relaxed break-words flex-1'>
                        {msg.text}
                      </div>
                    </div>
                  )
                }

                // AI Response
                return (
                  <div
                    key={msg.id}
                    className='p-4 sm:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl my-3 sm:my-4 max-w-full overflow-hidden'
                  >
                    <div className='flex items-center justify-between mb-3 pb-2.5 border-b border-zinc-800 text-xs text-zinc-400'>
                      <div className='flex items-center gap-1.5 font-semibold text-zinc-300 text-xs sm:text-sm'>
                        <span className='text-blue-400'>✦</span> AI Response
                      </div>
                    </div>
                    <Answers content={msg.text} />
                  </div>
                )
              })}

              {/* Word-by-word streaming response */}
              {streamingAnswer && (
                <div className='p-4 sm:p-6 rounded-2xl bg-zinc-900/90 border border-blue-500/30 shadow-2xl my-3 sm:my-4 max-w-full overflow-hidden'>
                  <div className='flex items-center justify-between mb-3 pb-2.5 border-b border-zinc-800 text-xs text-zinc-400'>
                    <div className='flex items-center gap-1.5 font-semibold text-zinc-300 text-xs sm:text-sm'>
                      <span className='text-blue-400'>✦</span> Generating response...
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

              {/* Thinking Loader */}
              {showLoader && (
                <div className='flex items-center gap-2 text-zinc-400 my-4 p-3.5 sm:p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 animate-pulse'>
                  <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce'></div>
                  <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]'></div>
                  <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]'></div>
                  <span className='text-xs sm:text-sm text-zinc-400 ml-1'>
                    Thinking with session context...
                  </span>
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

          {/* Bottom Input Area */}
          <footer className='p-2 sm:p-4 bg-zinc-950/90 sm:bg-transparent backdrop-blur-md border-t border-zinc-800/60 sm:border-t-0 shrink-0'>
            <div className='bg-zinc-800/95 w-full max-w-2xl mx-auto rounded-3xl sm:rounded-4xl border border-zinc-700/80 text-white flex items-center shadow-2xl focus-within:border-blue-500 transition-colors p-1 sm:p-1.5'>
              <input
                type='text'
                placeholder={
                  messages.length > 0
                    ? 'Ask follow-up question...'
                    : 'Ask me anything...'
                }
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !showLoader && !isTyping && askQuestion()}
                className='flex-1 border-none outline-none bg-transparent text-sm sm:text-base px-3 sm:px-4 py-2 text-white placeholder:text-zinc-500 min-w-0'
              />
              <button
                className='w-9 h-9 sm:w-auto sm:px-5 sm:py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-full sm:rounded-3xl cursor-pointer text-sm font-medium transition-colors shrink-0 flex items-center justify-center'
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

        {/* Custom HTML Confirmation Popup Modal */}
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
              {/* Modal Icon Badge */}
              <div className='w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4 shadow-inner'>
                <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 4v16m8-8H4' />
                </svg>
              </div>

              {/* Title & Description */}
              <h3 id='new-session-title' className='text-lg font-bold text-white mb-2'>
                Start a New Session?
              </h3>
              <p className='text-xs sm:text-sm text-zinc-400 mb-6 leading-relaxed'>
                This will clear your current conversation history and contextual search memory.
              </p>

              {/* Action Buttons */}
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
                  className='flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-blue-600/20'
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
