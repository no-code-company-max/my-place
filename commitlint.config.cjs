/**
 * Commit messages siguen Conventional Commits.
 * Idioma: español (ver CLAUDE.md § "Idioma"). No se enforza el idioma — se revisa en code review.
 * Tipos permitidos: feat, fix, refactor, chore, docs, test, perf, build, ci, style, revert.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0], // permite sentence-case en español
    'header-max-length': [2, 'always', 100],
  },
}
