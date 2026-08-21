import { describe, expect, it } from 'vitest'
import { CSP_DEVELOPPEMENT, CSP_PRODUCTION, politiqueDeSecurite } from '../vite.config.ts'

// La politique est injectée à la construction : le risque réel n'est pas qu'elle soit fausse,
// c'est qu'un assouplissement de développement parte en production (§13.3).
function metaInjectee(serveur: unknown): Record<string, string | boolean | undefined> {
  const plugin = politiqueDeSecurite()
  const hook = plugin.transformIndexHtml
  if (typeof hook !== 'object' || typeof hook.handler !== 'function') {
    throw new Error('transformIndexHtml doit exposer un handler')
  }
  const balises = hook.handler.call(undefined as never, '', { server: serveur } as never)
  if (!Array.isArray(balises) || balises[0] === undefined) throw new Error('aucune balise injectée')
  return balises[0].attrs ?? {}
}

describe('politique de sécurité du contenu (§13.1, §13.3)', () => {
  it('interdit toute requête hors origine en production', () => {
    expect(CSP_PRODUCTION).toContain("connect-src 'self'")
    expect(CSP_PRODUCTION).toContain("default-src 'self'")
    expect(CSP_PRODUCTION).toContain("object-src 'none'")
    expect(CSP_PRODUCTION).toContain("base-uri 'self'")
  })

  it('ne laisse aucun assouplissement de développement passer en production', () => {
    expect(CSP_PRODUCTION).not.toContain('ws:')
    expect(CSP_PRODUCTION).not.toContain('*')
    expect(CSP_PRODUCTION.split('; ')).toContain("script-src 'self'")
    expect(CSP_DEVELOPPEMENT).toContain('ws:')
  })

  it('pose la politique en tête du head, distincte selon le mode', () => {
    const plugin = politiqueDeSecurite()
    const hook = plugin.transformIndexHtml
    expect(typeof hook === 'object' && hook.order).toBe('pre')
    expect(metaInjectee(undefined)['content']).toBe(CSP_PRODUCTION)
    expect(metaInjectee({})['content']).toBe(CSP_DEVELOPPEMENT)
    expect(metaInjectee(undefined)['http-equiv']).toBe('Content-Security-Policy')
  })
})
