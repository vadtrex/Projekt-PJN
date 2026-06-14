import { useState } from 'react'
import StartScreen from './components/StartScreen'
import LoadingScreen from './components/LoadingScreen'
import QuizQuestion from './components/QuizQuestion'
import Summary from './components/Summary'

/**
 * Główny komponent — router stanów:
 * start → loading → quiz → summary
 */
export default function App() {
  const [screen, setScreen] = useState('start') // start | loading | quiz | summary
  const [quizData, setQuizData] = useState(null)
  const [config, setConfig] = useState({ seed: Math.floor(Math.random() * 10000), count: 10 })
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [userAnswers, setUserAnswers] = useState([])

  // --- Start quiz ---
  const handleStart = (seed, count) => {
    setConfig({ seed, count })
    setScreen('loading')
  }

  // --- Dane załadowane ---
  const handleDataLoaded = (data) => {
    setQuizData(data)
    setCurrentQuestion(0)
    setUserAnswers([])
    setScreen('quiz')
  }

  // --- Błąd ładowania ---
  const handleLoadError = () => {
    setScreen('start')
  }

  // --- Odpowiedź użytkownika ---
  const handleAnswer = (answer) => {
    setUserAnswers(prev => [...prev, answer])
  }

  // --- Następne pytanie ---
  const handleNext = () => {
    if (currentQuestion + 1 >= quizData.questions.length) {
      setScreen('summary')
    } else {
      setCurrentQuestion(prev => prev + 1)
    }
  }

  // --- Restart ---
  const handleRestart = () => {
    setQuizData(null)
    setCurrentQuestion(0)
    setUserAnswers([])
    setConfig(prev => ({ ...prev, seed: Math.floor(Math.random() * 10000) }))
    setScreen('start')
  }

  return (
    <>
      {screen === 'start' && (
        <StartScreen
          defaultSeed={config.seed}
          defaultCount={config.count}
          onStart={handleStart}
        />
      )}

      {screen === 'loading' && (
        <LoadingScreen
          seed={config.seed}
          count={config.count}
          onLoaded={handleDataLoaded}
          onError={handleLoadError}
        />
      )}

      {screen === 'quiz' && quizData && (
        <QuizQuestion
          key={currentQuestion}
          question={quizData.questions[currentQuestion]}
          questionIndex={currentQuestion}
          totalQuestions={quizData.questions.length}
          userScore={userAnswers.filter((a, i) => a === quizData.questions[i].correct_artist).length}
          answered={userAnswers[currentQuestion] || null}
          onAnswer={handleAnswer}
          onNext={handleNext}
        />
      )}

      {screen === 'summary' && quizData && (
        <Summary
          questions={quizData.questions}
          userAnswers={userAnswers}
          onRestart={handleRestart}
        />
      )}
    </>
  )
}
