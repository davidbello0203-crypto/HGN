-- =============================================
-- GNH — Migración v2 (ejecutar en Supabase SQL Editor)
-- Agrega columnas nuevas que no estaban en el setup inicial
-- Es seguro ejecutar múltiples veces (IF NOT EXISTS)
-- =============================================

-- Columnas nuevas en reservas
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS tipo         text DEFAULT 'nutricion' CHECK (tipo IN ('nutricion', 'entrenamiento')),
  ADD COLUMN IF NOT EXISTS notas_admin  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS guest_name   text,
  ADD COLUMN IF NOT EXISTS guest_phone  text,
  ADD COLUMN IF NOT EXISTS archived     boolean DEFAULT false;

-- Derivar tipo de reservas existentes basado en el servicio
UPDATE public.reservas
SET tipo = CASE
  WHEN servicio ILIKE '%entrenamiento%' AND servicio NOT ILIKE '%nutrici%' THEN 'entrenamiento'
  ELSE 'nutricion'
END
WHERE tipo IS NULL OR tipo = 'nutricion';

-- Política para que usuarios puedan cancelar sus propias reservas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reservas' AND policyname = 'Usuarios cancelan sus reservas'
  ) THEN
    CREATE POLICY "Usuarios cancelan sus reservas"
      ON reservas FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Política para que usuarios puedan archivar sus propias reservas canceladas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reservas' AND policyname = 'Usuarios archivan sus reservas'
  ) THEN
    CREATE POLICY "Usuarios archivan sus reservas"
      ON reservas FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Asignar rol admin a Bryan (cambiar el email por el suyo real)
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'TU_EMAIL_AQUI';

-- Verificar que todo esté en orden
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'reservas'
ORDER BY ordinal_position;
