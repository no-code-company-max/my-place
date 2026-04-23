import { test, expect } from '@playwright/test'
import { storageStateFor } from '../../helpers/playwright-auth'
import { placeUrl } from '../../helpers/subdomain'
import { E2E_EMAILS, E2E_PLACES } from '../../fixtures/e2e-data'
import {
  countReactionsOfTarget,
  createTestComment,
  createTestPost,
  deletePostById,
  deletePostBySlug,
  findUserIdByEmail,
} from '../../helpers/db'

/**
 * Reacciones sobre un comment: creamos post + comment propios del spec
 * (aislados de baseline que otros flows consumen), reaccionamos con
 * "corazón", verificamos INSERT en DB. El post y su comment se borran en
 * afterAll (cascade FK al post → comments → reactions → postReads).
 */

const palermoSlug = E2E_PLACES.palermo.slug
const palermoId = E2E_PLACES.palermo.id

test.describe.configure({ mode: 'serial' })

test.describe('Comment + Reactions — Palermo', () => {
  let postId: string
  let commentId: string
  let specSlug: string
  let commentBody: string

  test.beforeAll(async ({ browserName }) => {
    // Slug y body scopeados por project → chromium y mobile-safari no colisionan.
    specSlug = `comment-reactions-${browserName}`
    commentBody = `Comment seedeado comment-reactions ${browserName}.`
    const memberAId = await findUserIdByEmail(E2E_EMAILS.memberA)
    await deletePostBySlug(palermoId, specSlug)
    postId = await createTestPost({
      placeId: palermoId,
      authorUserId: memberAId,
      slug: specSlug,
      title: 'Post de comment-reactions spec',
    })
    commentId = await createTestComment({
      postId,
      placeId: palermoId,
      authorUserId: memberAId,
      body: commentBody,
    })
  })

  test.afterAll(async () => {
    await deletePostById(postId)
  })

  test.describe('como memberA', () => {
    test.use({ storageState: storageStateFor('memberA') })

    test('el comment seedeado aparece en el thread', async ({ page }) => {
      test.setTimeout(60_000)
      await page.goto(placeUrl(palermoSlug, `/conversations/${specSlug}`))
      await expect(page.getByText(commentBody)).toBeVisible({ timeout: 20_000 })
    })

    test('reaccionar con corazón al comment persiste en DB', async ({ page }) => {
      test.setTimeout(60_000)
      await page.goto(placeUrl(palermoSlug, `/conversations/${specSlug}`))
      await expect(page.getByText(commentBody)).toBeVisible({ timeout: 20_000 })

      const before = await countReactionsOfTarget('COMMENT', commentId)

      const commentArticle = page.getByRole('article').filter({ hasText: commentBody })
      await commentArticle.getByRole('button', { name: /Reaccionar con corazón/ }).click()

      await expect
        .poll(() => countReactionsOfTarget('COMMENT', commentId), { timeout: 30_000 })
        .toBe(before + 1)
    })
  })
})
