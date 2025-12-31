-- Optimize RLS policies by evaluating auth.uid() once per query.
DO $$
DECLARE
  r record;
  new_qual text;
  new_check text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE (
      (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%select auth.uid()%')
      OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%select auth.uid()%')
    )
  LOOP
    new_qual := r.qual;
    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
    END IF;

    new_check := r.with_check;
    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
    END IF;

    IF new_qual IS NOT NULL AND new_check IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
        r.policyname, r.schemaname, r.tablename, new_qual, new_check
      );
    ELSIF new_qual IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        r.policyname, r.schemaname, r.tablename, new_qual
      );
    ELSIF new_check IS NOT NULL THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        r.policyname, r.schemaname, r.tablename, new_check
      );
    END IF;
  END LOOP;
END $$;

-- Limit subscription management to service role only.
ALTER POLICY "Service role can manage subscriptions"
  ON public.user_subscriptions
  TO service_role
  USING (true)
  WITH CHECK (true);
