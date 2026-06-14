import { useEffect, useState, useRef } from 'react'

/**
 * Ekran ładowania — streamuje postęp z classify.py przez SSE.
 * Używa fetch + ReadableStream zamiast EventSource (lepsza kontrola nad timeoutami).
 */
export default function LoadingScreen({ seed, count, onLoaded, onError }) {
  const [status, setStatus] = useState('Nawiązywanie połączenia z procesem Pythona...')
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState([
    { id: 'data', label: 'Losowanie i parsowanie zwrotek', state: 'waiting' },
    { id: 'qwen-load', label: 'Inicjalizacja wag modelu Qwen3.5', state: 'waiting' },
    { id: 'qwen-classify', label: 'Klasyfikacja tekstów (Qwen3.5)', state: 'waiting' },
    { id: 'gemma-load', label: 'Inicjalizacja wag modelu Gemma4', state: 'waiting' },
    { id: 'gemma-classify', label: 'Klasyfikacja tekstów (Gemma4)', state: 'waiting' },
  ])
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const updateStep = (id, state) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, state } : s))
  }

  useEffect(() => {
    const abortController = new AbortController()
    abortRef.current = abortController

    async function runClassification() {
      try {
        const response = await fetch(
          `/api/classify?seed=${seed}&count=${count}`,
          { signal: abortController.signal }
        )

        if (!response.ok) {
          setError(`Serwer zwrócił błąd ${response.status}`)
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parsuj SSE events z bufora
          const parts = buffer.split('\n\n')
          buffer = parts.pop() // ostatni (niepełny) fragment

          for (const part of parts) {
            const lines = part.trim().split('\n')
            let eventType = null
            let eventData = null

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7)
              } else if (line.startsWith('data: ')) {
                eventData = line.slice(6)
              }
            }

            if (!eventType || !eventData) continue

            if (eventType === 'progress') {
              handleProgress(eventData)
            } else if (eventType === 'result') {
              try {
                const data = JSON.parse(eventData)
                setProgress(100)
                setStatus('Klasyfikacja ukończona. Przygotowywanie quizu.')
                setTimeout(() => onLoaded(data), 500)
                return
              } catch {
                setError('Błąd dekodowania odpowiedzi z modeli.')
                return
              }
            } else if (eventType === 'error') {
              try {
                const errData = JSON.parse(eventData)
                setError(errData.error || 'Nieznany błąd potoku')
              } catch {
                setError('Błąd wewnętrzny serwera klasyfikacji')
              }
              return
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(`Błąd sieci/połączenia: ${err.message}`)
      }
    }

    function handleProgress(msg) {
      if (msg === 'start') {
        setStatus('Uruchamianie potoku klasyfikacji...')
      } else if (msg.startsWith('data:')) {
        const n = parseInt(msg.split(':')[1])
        updateStep('data', 'done')
        setStatus(`Wylosowano i przygotowano ${n} zwrotek.`)
        setProgress(5)
      } else if (msg === 'qwen:loading') {
        updateStep('qwen-load', 'active')
        setStatus('Ładowanie modelu Qwen3.5 do pamięci...')
        setProgress(10)
      } else if (msg === 'qwen:ready') {
        updateStep('qwen-load', 'done')
        updateStep('qwen-classify', 'active')
        setStatus('Qwen3.5 klasyfikuje zwrotki...')
        setProgress(20)
      } else if (msg.startsWith('qwen:') && msg !== 'qwen:done') {
        const [current, total] = msg.replace('qwen:', '').split('/')
        const pct = 20 + (parseInt(current) / parseInt(total)) * 25
        setProgress(pct)
        setStatus(`Qwen3.5: Klasyfikowanie zwrotki ${current} z ${total}`)
      } else if (msg === 'qwen:done') {
        updateStep('qwen-classify', 'done')
        setStatus('Zwalnianie pamięci po modelu Qwen3.5...')
        setProgress(48)
      } else if (msg === 'gemma:loading') {
        updateStep('gemma-load', 'active')
        setStatus('Ładowanie modelu Gemma4 do pamięci...')
        setProgress(50)
      } else if (msg === 'gemma:ready') {
        updateStep('gemma-load', 'done')
        updateStep('gemma-classify', 'active')
        setStatus('Gemma4 klasyfikuje zwrotki...')
        setProgress(60)
      } else if (msg.startsWith('gemma:') && msg !== 'gemma:done') {
        const [current, total] = msg.replace('gemma:', '').split('/')
        const pct = 60 + (parseInt(current) / parseInt(total)) * 25
        setProgress(pct)
        setStatus(`Gemma4: Klasyfikowanie zwrotki ${current} z ${total}`)
      } else if (msg === 'gemma:done') {
        updateStep('gemma-classify', 'done')
        setStatus('Czyszczenie pamięci podręcznej...')
        setProgress(90)
      } else if (msg === 'finished') {
        setProgress(100)
        setStatus('Wszystkie procesy zakończone.')
      }
    }

    runClassification()

    return () => {
      abortController.abort()
    }
  }, [seed, count, onLoaded])

  if (error) {
    return (
      <div className="loading-screen">
        <div className="loading-card glass-card" style={{ borderColor: 'var(--color-wrong-border)' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--color-wrong)' }}>
            [FATAL ERROR]
          </span>
          <h2 className="loading-header-title" style={{ marginTop: '0.5rem', color: 'var(--color-wrong)' }}>
            Błąd procesu
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '1rem 0 1.5rem', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5 }}>
            {error}
          </p>
          <button className="btn btn-primary" onClick={onError} style={{ background: 'var(--color-wrong)', borderColor: 'var(--color-wrong)', color: '#fff' }}>
            Powrót do menu
          </button>
        </div>
      </div>
    )
  }

  const getStatusText = (state) => {
    switch (state) {
      case 'done': return 'OK'
      case 'active': return 'RUNNING'
      default: return 'QUEUED'
    }
  }

  const getIndicator = (state) => {
    switch (state) {
      case 'done': return '[+]'
      case 'active': return '[>]'
      default: return '[ ]'
    }
  }

  return (
    <div className="loading-screen">
      <div className="loading-card glass-card">
        <h2 className="loading-header-title">PROCES KLASYFIKACJI LLM</h2>
        <p className="loading-status-sub">{status}</p>

        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="loading-console">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`console-line ${step.state === 'active' ? 'active' : ''} ${step.state === 'done' ? 'done' : ''}`}
            >
              <div>
                <span className="console-indicator">{getIndicator(step.state)}</span>
                <span>{step.label}</span>
              </div>
              <span className={`console-status ${step.state}`}>
                {getStatusText(step.state)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6, fontFamily: 'JetBrains Mono, monospace' }}>
          [INFO] Sekwencyjny proces zapobiega przepełnieniu pamięci RAM urządzenia. Wyłączanie poprzedniego modelu następuje przed inicjalizacją kolejnego.
        </p>
      </div>
    </div>
  )
}
