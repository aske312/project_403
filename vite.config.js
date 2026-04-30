import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { execSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const lock = JSON.parse(readFileSync(new URL('./package-lock.json', import.meta.url), 'utf-8'))
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

function getLockedDependencyVersion(name) {
  return lock.packages?.[`node_modules/${name}`]?.version
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
    return 'local'
  }
}

function getProjectBranch(env) {
  if (env.PROJECT_BRANCH || env.GIT_BRANCH || env.BRANCH) {
    return env.PROJECT_BRANCH ?? env.GIT_BRANCH ?? env.BRANCH
  }

  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim() || 'detached'
  } catch {
    return 'unknown'
  }
}

function frontendMetricsPlugin({ appName, appVersion, frontendStack, projectBranch }) {
  const startedAt = performance.now()
  let startupMs = null

  return {
    name: 'project-403-frontend-metrics',
    configureServer(server) {
      const markReady = () => {
        startupMs = Math.round((performance.now() - startedAt) * 10) / 10
      }

      if (server.httpServer?.listening) {
        markReady()
      } else {
        server.httpServer?.once('listening', markReady)
      }

      server.middlewares.use('/__project403/frontend-metrics', (request, response, next) => {
        if (request.method !== 'GET') {
          next()
          return
        }

        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(
          JSON.stringify({
            status: 'ok',
            app: appName,
            stack: frontendStack,
            version: appVersion,
            branch: projectBranch,
            startup_ms: startupMs,
            mode: server.config.mode,
          }),
        )
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const projectBranch = getProjectBranch(env)
  const envBuildId = env.BUILD_ID && env.BUILD_ID.toLowerCase() !== 'dev' ? env.BUILD_ID : null
  const buildId = envBuildId ?? getGitShortSha()
  const appVersion = `v ${env.VERSION ?? pkg.version} build ${buildId}`
  const appName = env.APP_NAME ?? pkg.name
  const frontendStack = [
    formatDependency('JavaScript V8', process.versions.v8),
    formatDependency('Node.js', process.versions.node),
    formatDependency('react', getLockedDependencyVersion('react') ?? pkg.dependencies.react),
    formatDependency('vite', getLockedDependencyVersion('vite') ?? pkg.devDependencies.vite),
  ].join(', ')
  const backendStack = [
    getPythonVersion(),
    formatDependency('FastAPI', getRequirementVersion('fastapi')),
    formatDependency('SQLAlchemy', getRequirementVersion('SQLAlchemy')),
  ].join(', ')

  return {
    plugins: [react(), frontendMetricsPlugin({ appName, appVersion, frontendStack, projectBranch })],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(appName),
      'import.meta.env.VITE_PROJECT_BRANCH': JSON.stringify(projectBranch),
      'import.meta.env.VITE_FRONTEND_STACK': JSON.stringify(frontendStack),
      'import.meta.env.VITE_BACKEND_STACK': JSON.stringify(backendStack),
    },
  }
})
