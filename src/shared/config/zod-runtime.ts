import { z } from 'zod'

z.config({ jitless: true })

// DEBUG TEMPORAL — confirmar timing del bootstrap relativo a errores client.
// Aparece tanto en server logs (Vercel runtime) como en browser console (cliente).
// Si ves el error de "Algo no salió bien" SIN ver este log antes en console del
// browser, el bootstrap no llega a correr en el client → el JIT de Zod no está
// realmente desactivado y hay que mover el side-effect a un lugar más temprano.
// Remover una vez confirmado el flow.
if (typeof console !== 'undefined') {
  console.log(
    '[zod-runtime] jitless bootstrapped',
    typeof window === 'undefined' ? '(server)' : '(client)',
  )
}
