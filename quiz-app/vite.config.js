import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Vite plugin — endpoint /api/classify
 * Spawnuje classify.py i streamuje postęp przez SSE.
 */
function classifyPlugin() {
  return {
    name: 'classify-plugin',
    configureServer(server) {
      server.middlewares.use('/api/classify', (req, res) => {
        // req.originalUrl ma pełny URL z query params
        const fullUrl = req.originalUrl || req.url
        const url = new URL(fullUrl, `http://${req.headers.host}`)
        const seed = url.searchParams.get('seed') || '42'
        const count = url.searchParams.get('count') || '10'

        // SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })

        // Heartbeat co 5s — utrzymuje połączenie podczas ładowania modeli
        const heartbeat = setInterval(() => {
          res.write(': heartbeat\n\n')
        }, 5000)

        const scriptPath = join(__dirname, 'classify.py')
        const python = process.platform === 'win32' ? 'python' : 'python3'

        console.log(`[classify] Spawning: ${python} ${scriptPath} --seed ${seed} --count ${count}`)

        const child = spawn(python, [
          scriptPath,
          '--seed', seed,
          '--count', count,
        ], {
          cwd: __dirname,
          env: { ...process.env },
        })

        let stdoutData = ''

        // Postęp (stderr) → SSE + logowanie
        child.stderr.on('data', (data) => {
          const text = data.toString()
          const lines = text.split('\n').filter(Boolean)
          for (const line of lines) {
            if (line.startsWith('PROGRESS:')) {
              const msg = line.replace('PROGRESS:', '')
              console.log(`[classify] Progress: ${msg}`)
              res.write(`event: progress\ndata: ${msg}\n\n`)
            } else {
              // Inne linie stderr (warnings etc.) — loguj
              console.log(`[classify] stderr: ${line}`)
            }
          }
        })

        // Wynik (stdout)
        child.stdout.on('data', (data) => {
          stdoutData += data.toString()
        })

        child.on('close', (code) => {
          clearInterval(heartbeat)
          console.log(`[classify] Process exited with code ${code}`)
          if (code === 0) {
            try {
              // Wyodrębnij JSON ze stdoutData (może zawierać ostrzeżenia/logi z bibliotek przed właściwym JSON)
              let parsedResult = null
              
              // Sposób 1: Szukaj linijki zaczynającej się od {"seed" lub będącej poprawnym obiektem JSON
              const lines = stdoutData.split('\n')
              for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim()
                if (line.startsWith('{"seed":') || (line.startsWith('{') && line.endsWith('}'))) {
                  try {
                    parsedResult = JSON.parse(line)
                    break
                  } catch (e) {
                    // ignoruj i szukaj dalej
                  }
                }
              }

              // Sposób 2: Szukaj pierwszego {"seed": i ostatniego } w całym buforze
              if (!parsedResult) {
                const startIdx = stdoutData.indexOf('{"seed":')
                if (startIdx !== -1) {
                  const endIdx = stdoutData.lastIndexOf('}')
                  if (endIdx > startIdx) {
                    try {
                      parsedResult = JSON.parse(stdoutData.slice(startIdx, endIdx + 1))
                    } catch (e) {
                      // ignoruj
                    }
                  }
                }
              }

              if (!parsedResult) {
                throw new Error('Nie znaleziono poprawnego JSON w strumieniu wyjściowym')
              }

              res.write(`event: result\ndata: ${JSON.stringify(parsedResult)}\n\n`)
            } catch (err) {
              console.log(`[classify] JSON parse error: ${err.message}. Raw stdout (first 500 chars): ${stdoutData.slice(0, 500)}`)
              res.write(`event: error\ndata: ${JSON.stringify({ error: 'Błąd parsowania JSON odpowiedzi z Pythona', raw: stdoutData.slice(0, 500) })}\n\n`)
            }
          } else {
            res.write(`event: error\ndata: ${JSON.stringify({ error: `Python zakończył się kodem ${code}`, stderr: stdoutData.slice(0, 500) })}\n\n`)
          }
          res.write(`event: done\ndata: ok\n\n`)
          res.end()
        })

        child.on('error', (err) => {
          clearInterval(heartbeat)
          console.log(`[classify] Spawn error: ${err.message}`)
          res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`)
          res.end()
        })

        // Cleanup na zamknięcie połączenia
        req.on('close', () => {
          clearInterval(heartbeat)
          if (!child.killed) child.kill()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), classifyPlugin()],
  server: {
    port: 5173,
  },
})
