import React, { useState, useRef, useEffect } from 'react'
import { getSchemes, searchSchemes } from '../api/schemes'

/**
 * Global chatbot. This is a rule-based/retrieval assistant over the app's own
 * scheme data (per the spec: "should use the application's scheme information
 * where appropriate" and "should NOT invent information"). It is intentionally
 * NOT wired to an external LLM here — plugging in a real LLM later just means
 * replacing answerQuery() with an API call, without changing the UI.
 */
export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hi! I can help explain schemes, eligibility, required documents, or how to apply. What would you like to know?" },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  const handleSend = async () => {
    const text = input.trim()
    if (!text) return
    setMessages((m) => [...m, { role: 'user', text }])
    setInput('')
    setLoading(true)
    try {
      const reply = await answerQuery(text)
      setMessages((m) => [...m, { role: 'bot', text: reply }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg flex items-center justify-center text-xl z-40 transition-transform hover:scale-105"
        aria-label="Open chatbot"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 w-[92vw] max-w-sm h-[28rem] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col z-40 overflow-hidden">
          <div className="bg-primary-600 text-white px-4 py-3">
            <p className="font-semibold text-sm">Scheme Assistant</p>
            <p className="text-xs text-primary-100">Ask about schemes, eligibility, or documents</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-400">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your question..."
              className="input-field text-sm"
            />
            <button onClick={handleSend} className="btn-primary text-sm px-3">
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}

async function answerQuery(query) {
  const lower = query.toLowerCase()

  try {
    if (lower.includes('document') || lower.includes('upload')) {
      return "Required documents vary by scheme, but commonly include Aadhaar, an income certificate, and a caste/category certificate if applicable. Open a scheme's detail page to see its exact 'Required Documents' list, or visit your Wallet to upload and verify them."
    }

    if (lower.includes('apply') || lower.includes('application process')) {
      return "Each scheme's detail page has an 'Application Process' section and an 'Apply Officially' button that takes you to the real government application site — applications aren't submitted through this app."
    }

    if (lower.includes('eligib') || lower.includes('qualify')) {
      return "Eligibility is checked against each scheme's official criteria (age, income, category, etc.) using your profile. Open any scheme to see a 'Why You Match' breakdown, or complete your Profile for more accurate results."
    }

    // Otherwise, try to find matching schemes for the query.
    const results = await searchSchemes(query)
    if (results && results.length > 0) {
      const names = results.slice(0, 3).map((s) => s.name).join(', ')
      return `I found ${results.length} scheme(s) that might match: ${names}. Try searching for these on the home page to see full details.`
    }

    return "I couldn't find anything specific on that in the current scheme data. Try rephrasing, or browse categories on the home page — I don't want to guess at something I'm not sure about."
  } catch (e) {
    return "I'm having trouble reaching scheme data right now. Please try again in a moment."
  }
}
