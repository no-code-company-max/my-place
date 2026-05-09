# Supabase connection string: copiar literal del dashboard

El hostname del pooler varía entre proyectos (`aws-0-<region>` vs `aws-1-<region>` vs otros) y no es derivable del project ref ni de la región.

**Fix:** siempre ir a Dashboard → Connect → ORMs y pegar el URI exacto, nunca construirlo a mano.
