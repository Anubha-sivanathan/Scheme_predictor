import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { searchSchemes } from '../api/schemes'

// Intent keywords in every supported language (lower-cased substrings).
const DOC_WORDS = ['document', 'upload', 'ஆவண', 'பதிவேற்ற', 'दस्तावेज', 'अपलोड']
const APPLY_WORDS = ['apply', 'application process', 'விண்ணப்ப', 'आवेदन']
const ELIGIBILITY_WORDS = ['eligib', 'qualify', 'தகுதி', 'पात्र']

/**
 * Global chatbot. This is a rule-based/retrieval assistant over the app's own
 * scheme data (per the spec: "should use the application's scheme information
 * where appropriate" and "should NOT invent information"). It is intentionally
 * NOT wired to an external LLM here — plugging in a real LLM later just means
 * replacing answerQuery() with an API call, without changing the UI.
 */
export default function Chatbot() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  // The greeting is stored as a marker so it follows the language when the user switches.
  const [messages, setMessages] = useState([{ role: 'bot', greeting: true }])
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
      const reply = await answerQuery(text, t)
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
        aria-label={t('chatbot.open')}
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 w-[92vw] max-w-sm h-[28rem] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col z-40 overflow-hidden">
          <div className="bg-primary-600 text-white px-4 py-3">
            <p className="font-semibold text-sm">{t('chatbot.title')}</p>
            <p className="text-xs text-primary-100">{t('chatbot.subtitle')}</p>
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
                  {m.greeting ? t('chatbot.greeting') : m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-xl px-3 py-2 text-sm text-slate-400">
                  {t('chatbot.thinking')}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('chatbot.placeholder')}
              aria-label={t('chatbot.placeholder')}
              className="input-field text-sm"
            />
            <button onClick={handleSend} className="btn-primary text-sm px-3">
              {t('chatbot.send')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export async function answerQuery(query, t) {
  const lower = query.toLowerCase()
  const has = (words) => words.some((w) => lower.includes(w))

  try {
    if (has(DOC_WORDS)) {
      return t('chatbot.docs')
    }

    if (has(APPLY_WORDS)) {
      return t('chatbot.apply')
    }

    if (has(ELIGIBILITY_WORDS)) {
      return t('chatbot.eligibility')
    }

    // Otherwise, try to find matching schemes for the query.
    const results = await searchSchemes(query)
    if (results && results.length > 0) {
      const names = results.slice(0, 3).map((s) => s.name).join(', ')
      return t('chatbot.found', { count: results.length, names })
    }

    return t('chatbot.notFound')
  } catch (e) {
    return t('chatbot.error')
  }
}
