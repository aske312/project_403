import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { execSync } from 'node:child_process'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const requirements = readFileSync(new URL('./requirements.txt', import.meta.url), 'utf-8')

function getRequirementVersion(name) {
  const normalizedName = name.toLowerCase()
  const line = requirements
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${normalizedName}==`))

  return line?.split('==')[1]?.trim()
}

function formatDependency(name, version) {
  return version ? `${name} ${version.replace(/^[~^]/, '')}` : name
}

function getPythonVersion() {
  const commands = [
    process.platform === 'win32' ? '.\\.venv\\Scripts\\python.exe --version' : './.venv/bin/python --version',
    'python --version',
  ]

  for (const command of commands) {
    try {
      return execSync(command, { encoding: 'utf-8' }).trim().replace(/^Python\s+/, 'Python ')
    } catch {
      // Try the next available Python command.
    }
  }

  return 'Python'
}

function getGitShortSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appVersion = `v ${env.VERSION ?? pkg.version} build ${getGitShortSha()}`

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_FRONTEND_STACK': JSON.stringify(
        [
          'JavaScript',
          formatDependency('React', pkg.dependencies.react),
          formatDependency('Vite', pkg.devDependencies.vite),
        ].join(', '),
      ),
      'import.meta.env.VITE_BACKEND_STACK': JSON.stringify(
        [
          getPythonVersion(),
          formatDependency('FastAPI', getRequirementVersion('fastapi')),
          formatDependency('SQLAlchemy', getRequirementVersion('SQLAlchemy')),
        ].join(', '),
      ),
    },
  }
})
