import { useState } from 'react'

/**
 * Ekran startowy — konfiguracja quizu.
 * Slider: liczba zwrotek (3–20), input: random seed.
 */
export default function StartScreen({ defaultSeed, defaultCount, onStart }) {
  const [count, setCount] = useState(defaultCount)
  const [seed, setSeed] = useState(defaultSeed)

  const handleSubmit = (e) => {
    e.preventDefault()
    onStart(seed, count)
  }

  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 10000))
  }

  return (
    <div className="start-screen">
      <div className="header">
        <span className="brand-badge">BENCHMARK NLP</span>
        <h1 className="brand-title">
          QUIZ <span className="accent-text">RAPOWY</span>
        </h1>
        <p className="brand-subtitle">
          Rozpoznaj wykonawcę po zwrotce i zobacz, jak radzą sobie z tym zadaniem modele językowe Qwen oraz Gemma.
        </p>
      </div>

      <form className="config-card glass-card" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="count-slider">Liczba zwrotek</label>
          <div className="range-value">{count}</div>
          <input
            id="count-slider"
            type="range"
            className="range-slider"
            min="3"
            max="20"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            <span>03</span>
            <span>20</span>
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="seed-input">Random seed</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="seed-input"
              type="number"
              className="input-field"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={randomizeSeed}
              title="Losuj nowy seed"
              style={{ padding: '0 1rem', fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.8rem' }}
            >
              LOSUJ
            </button>
          </div>
        </div>

        <div className="start-actions">
          <button type="submit" className="btn btn-primary">
            Rozpocznij test
          </button>
        </div>
      </form>

      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.6, fontFamily: 'JetBrains Mono, monospace' }}>
          [INFO] Modele LLM zostaną załadowane sekwencyjnie w celu klasyfikacji zwrotek. Proces zależy od procesora urządzenia.
        </p>
      </div>
    </div>
  )
}
