# Search — Design Notes

## Header

- 56px sticky, `--bg`, hairline bottom.
- Padding 0 12. Layout: back chip 36×36 + gap 10 + input flex-1.

### Search input

- Height 40, radius 999, `--surface` bg, 0.5 border `--border`.
- Inner padding: 12 left, 12 right when value empty, 36 right when value present.
- Magnifier 16×16, color `--muted`, position absolute left 12.
- Input: padding-left 38, font Inter 400 / 15, color `--text`, placeholder `--muted`.
- Clear button: 24×24, position absolute right 8, top 50% translate -50%. Round, `--soft` bg, ✕ glyph 12.

## Section titles

- Inter 600 / 11, `letter-spacing: 0.6px`, `text-transform: uppercase`, color `--muted`.
- Padding: 18 12 6.
- Optional count: `· N` in same style.

## Recent / suggested rows

- Padding 12. Layout: 24×24 icon (left) + Inter / 14 label (mid) + chevron (right).
- 0.5 hairline between rows. Last row no hairline.
- Hover/press: `--soft` bg.

### Recent row icon

- Magnifier 14×14 with circle bg `--soft`, color `--muted`.

### Suggested row icon

- The section emoji (calendar/chat/library) at 18px.

## Result rows

### Event row

- Padding 12.
- 36×36 emoji circle (background `--accent-soft`, emoji 18 centered).
- Title Inter 600 / 14 + meta "sáb 19:00" Inter / 12 muted.

### Thread row

- 36×36 chat bubble icon, `--soft` bg, `--muted` icon.
- Title Inter 600 / 14, meta "{n} respuestas" Inter / 12 muted.

### Person row

- 36×36 avatar (member color).
- Name Inter 600 / 14.

### Doc row

- 36×36 file icon (reuse `<FileIcon>` from library).
- Title Inter 600 / 14, meta "{categoryTitle}" Inter / 12 muted.

## "Ver todos" link

- After 5 results in a group, if more exist:
- Padding 10 12, Inter 500 / 13, color `--accent`. No icon.
- Tap → navigate to that section pre-filtered with the query (out of scope v1; can stub).

## No results

- Padding 48 24, centered.
- 48 emoji + Inter 500 / 14 + Inter / 13 muted line.

## Tokens

| Element        | Token       |
| -------------- | ----------- |
| Background     | `--bg`      |
| Input bg       | `--surface` |
| Hairline       | `--border`  |
| Section title  | `--muted`   |
| Body text      | `--text`    |
| Pressed row    | `--soft`    |
| Accent (links) | `--accent`  |

## Behavior

### Debounce

```ts
const [q, setQ] = useState('')
const debounced = useDebouncedValue(q, 200)
const { data } = useQuery({
  queryKey: ['search', communityId, debounced],
  queryFn: () => fetchSearch(communityId, debounced),
  enabled: debounced.length > 0,
})
```

### Recent queries

- Storage key: `search-recents-{communityId}`.
- Cap at 5, dedupe (move to top if exists).
- Save when:
  - User taps a result.
  - User submits (Enter on input).
- Clear button on each recent row (×) removes individual.
- "Limpiar" link below recents removes all.
