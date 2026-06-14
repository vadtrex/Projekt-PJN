/**
 * Ekran podsumowania — porównanie wyników: Gracz vs Qwen vs Gemma.
 */
export default function Summary({ questions, userAnswers, onRestart }) {
  // Oblicz wyniki
  const userCorrect = questions.filter((q, i) => userAnswers[i] === q.correct_artist).length
  const qwenCorrect = questions.filter(q => q.qwen_prediction === q.correct_artist).length
  const gemmaCorrect = questions.filter(q => q.gemma_prediction === q.correct_artist).length
  const total = questions.length

  const scores = [
    { name: 'HUMAN', id: 'human', score: userCorrect },
    { name: 'QWEN 3.5', id: 'qwen', score: qwenCorrect },
    { name: 'GEMMA 4', id: 'gemma', score: gemmaCorrect },
  ]

  const maxScore = Math.max(userCorrect, qwenCorrect, gemmaCorrect)
  const winners = scores.filter(s => s.score === maxScore)

  const getWinnerText = () => {
    if (winners.length === 3) return 'REMIS WSZYSTKICH UCZESTNIKÓW'
    if (winners.length === 2) {
      return `REMIS: ${winners.map(w => w.name).join(' ORAZ ')}`
    }
    if (winners[0].name === 'HUMAN') return 'ZWYCIĘSTWO CZŁOWIEKA! LLM ZOSTAŁY POKONANE'
    return `ZWYCIĘSTWO MODELU: ${winners[0].name}`
  }

  // Sortowanie tabeli liderów
  const sortedScores = [...scores].sort((a, b) => b.score - a.score)

  return (
    <div className="summary-screen">
      {/* Header */}
      <div className="summary-header">
        <h1 className="title">PODSUMOWANIE BENCHMARKU</h1>
        <div className="winner-announce">{getWinnerText()}</div>
      </div>

      {/* Tabela wyników (Leaderboard) */}
      <div className="scores-grid">
        {sortedScores.map((s, index) => {
          const isLeader = s.score === maxScore
          return (
            <div
              key={s.name}
              className={`score-row ${isLeader ? 'leader' : ''}`}
            >
              <div className="row-place">#{index + 1}</div>
              <div className="row-name">{s.name}</div>
              <div className="row-score">{s.score} / {total}</div>
              <div className="row-pct">{((s.score / total) * 100).toFixed(0)}%</div>
            </div>
          )
        })}
      </div>

      {/* Szczegóły pytań */}
      <h2 style={{ marginTop: '1.5rem', fontSize: '1.1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        METRYKI SZCZEGÓŁOWE
      </h2>

      <div className="details-list">
        {questions.map((q, i) => {
          const userAnswer = userAnswers[i]
          const userOk = userAnswer === q.correct_artist
          const qwenOk = q.qwen_prediction === q.correct_artist
          const gemmaOk = q.gemma_prediction === q.correct_artist
          const versePreview = q.verse.replace(/\\n/g, ' / ').slice(0, 80) + '...'

          return (
            <div key={i} className="detail-row glass-card">
              <div className="detail-header">
                <span className="detail-title">
                  TEST {String(i + 1).padStart(2, '0')} — {q.song}
                </span>
              </div>
              <div className="detail-verse-preview">"{versePreview}"</div>
              <div className="detail-answers">
                <span className="detail-chip correct-answer" title="Prawidłowa odpowiedź">
                  CEL: {q.correct_artist}
                </span>
                <span className="detail-chip human" title="Twój wybór">
                  HUMAN: {userAnswer} <span style={{ color: userOk ? 'var(--color-correct)' : 'var(--color-wrong)', fontWeight: 700 }}>{userOk ? 'OK' : 'X'}</span>
                </span>
                <span className="detail-chip qwen" title="Wybór Qwena">
                  QWEN: {q.qwen_prediction} <span style={{ color: qwenOk ? 'var(--color-correct)' : 'var(--color-wrong)', fontWeight: 700 }}>{qwenOk ? 'OK' : 'X'}</span>
                </span>
                <span className="detail-chip gemma" title="Wybór Gemmy">
                  GEMMA: {q.gemma_prediction} <span style={{ color: gemmaOk ? 'var(--color-correct)' : 'var(--color-wrong)', fontWeight: 700 }}>{gemmaOk ? 'OK' : 'X'}</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Restart */}
      <div style={{ marginTop: '1.5rem', marginBottom: '3rem' }}>
        <button className="btn btn-primary" onClick={onRestart}>
          Uruchom ponownie benchmark
        </button>
      </div>
    </div>
  )
}
