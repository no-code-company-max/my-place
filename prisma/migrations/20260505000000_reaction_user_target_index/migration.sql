-- Index compuesto para acelerar `aggregateReactions` viewer's-own lookup.
-- Hoy `findMany({ where: { userId, OR: [{targetType, targetId}, ...] } })`
-- usa `Reaction_userId_idx` y filtra in-memory ~50 targets. Con (userId,
-- targetType, targetId), el lookup es index-only.
CREATE INDEX "Reaction_userId_targetType_targetId_idx"
  ON "Reaction" ("userId", "targetType", "targetId");
