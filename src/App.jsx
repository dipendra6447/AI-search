import { useState } from 'react'
import './App.css'
import { API_URL } from './constants'
import Answers from './components/Answers'

function App() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState('')
  const [showLoader, setShowLoader] = useState(false);
  const payload = {
    "contents": [
      {
        "parts": [
          {
            "text": question
          }
        ]
      }
    ]
  }
  const askQuestion = async () => {
    setShowLoader(true);
    let response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      setShowLoader(false);
    }

    response = await response.json();
    let answer = response.candidates[0].content.parts[0].text
    answer = answer.split("* ")
    answer = answer.map(item => item.trim())

    setResult(answer)
  }
  return (
    <>
      <div className='grid grid-cols-5 h-screen'>
        <div className='col-span-1 bg-zinc-800'>

        </div>
        <div className='col-span-4 p-6'>
          <div className='container h-190 text-white text-center mb-4 overflow-y-auto p-4 scrollbar-track-transparent scrollbar-thumb-transparent scrollbar-w-2'>
            <div>
              <ul>
                {result && result.map((item, index) => (
                  <li key={index} className='mb-2 text-left'>
                    <p>
                      <Answers ans={item} />
                    </p>
                  </li>

                ))}
              </ul>
              {showLoader && (
                <div className="text-left animate-pulse mt-4">Loading...</div>
              )}
            </div>

          </div>
          <div className='bg-zinc-800 w-1/2 m-auto rounded-4xl border border-zinc-700 text-white h-16 flex'>
            <input type="text" placeholder='Ask me anything...' value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askQuestion()} className='p-4 border-none outline-none h-full w-full' />
            <button className='p-4 cursor-pointer' onClick={askQuestion}>Ask</button>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
