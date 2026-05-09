# RHF `register(name)` + `onChange` custom: si solo overrideás el `onChange`, RHF NO actualiza su field state

**Caso típico:**

```tsx
<input {...register('foo')} onChange={(e) => doStuff(e)} />
```

El spread de `register` incluye un `onChange` interno de RHF; tu prop posterior lo **sobreescribe completamente**, así que `formState.values.foo` se queda en el default y `formState.isDirty` no flippea.

**Síntoma:** el `Save` button queda disabled aunque el user toggleó algo.

**Fix:** en el handler custom llamá explícitamente `setValue(name, nextValue, { shouldDirty: true })` antes/después de tu lógica.

Patrón aplicado en `editor-config/ui/editor-config-form.tsx:handleToggle`.

**Alternativa:** usar `<Controller>` en vez de `register`, pero para checkbox triviales el spread + setValue es más liviano.
