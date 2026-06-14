import { useState } from 'react'

const LETTERS = ['A', 'B', 'C', 'D']

/**
 * Ekran pytania quizowego.
 * Po kliknięciu opcji:
 * - poprawna odpowiedź: zielona ramka/tło
 * - błędna odpowiedź użytkownika: czerwona ramka/tło
 * - odpowiedź Qwena: niebieska plakietka
 * - odpowiedź Gemmy: żółta plakietka
 */
export default function QuizQuestion({
  question,
  questionIndex,
  totalQuestions,
  userScore,
  answered,
  onAnswer,
  onNext,
}) {
  const [selected, setSelected] = useState(answered)
  const isAnswered = selected !== null

  const handleClick = (artist) => {
    if (isAnswered) return
    setSelected(artist)
    onAnswer(artist)
  }

  const getOptionClass = (artist) => {
    if (!isAnswered) return ''
    if (artist === question.correct_artist) return 'correct'
    if (artist === selected && artist !== question.correct_artist) return 'wrong'
    return ''
  }

  const getModelBadges = (artist) => {
    if (!isAnswered) return null
    const badges = []
    if (artist === question.qwen_prediction) {
      badges.push(
        <span key="qwen" className="model-badge qwen" title={`Pewność: ${(question.qwen_confidence * 100).toFixed(1)}%`}>
          QWEN [{(question.qwen_confidence * 100).toFixed(0)}%]
        </span>
      )
    }
    if (artist === question.gemma_prediction) {
      badges.push(
        <span key="gemma" className="model-badge gemma" title={`Pewność: ${(question.gemma_confidence * 100).toFixed(1)}%`}>
          GEMMA [{(question.gemma_confidence * 100).toFixed(0)}%]
        </span>
      )
    }
    return badges.length > 0 ? <div className="option-badges">{badges}</div> : null
  }

  // Formatowanie tekstu zwrotki — zamień \n na nowe linie
  const formattedVerse = question.verse.replace(/\\n/g, '\n')

  return (
    <div className="quiz-screen" key={questionIndex}>
      {/* Header */}
      <div className="quiz-header">
        <div className="question-counter">
          PYTANIE {String(questionIndex + 1).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
        </div>
        <div className="score-badge">
          PUNKTY: {userScore}
        </div>
      </div>

      {/* Zwrotka */}
      <div className="verse-card glass-card">
        <div className="verse-text">"{formattedVerse}"</div>
      </div>

      {/* Opcje */}
      <div className="options-grid">
        {question.options.map((artist, idx) => (
          <button
            key={artist}
            className={`option-btn ${getOptionClass(artist)}`}
            onClick={() => handleClick(artist)}
            disabled={isAnswered}
          >
            <span className="option-letter">{LETTERS[idx]}</span>
            <span>{artist}</span>
            {getModelBadges(artist)}
          </button>
        ))}
      </div>

      {/* Następne pytanie */}
      {isAnswered && (
        <div className="next-btn-container">
          <button className="btn btn-primary" onClick={onNext}>
            {questionIndex + 1 >= totalQuestions ? 'Wyniki benchmarku' : 'Kolejne pytanie'}
          </button>
        </div>
      )}
    </div>
  )
}
