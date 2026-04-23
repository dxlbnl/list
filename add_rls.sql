-- 1. Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_users ENABLE ROW LEVEL SECURITY;

-- 2. Create Security Definer helper function
-- Updated to use (auth.jwt() ->> 'sub') for Nanoid compatibility
CREATE OR REPLACE FUNCTION public.is_list_member(check_list_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.list_users 
    WHERE list_id = check_list_id 
    AND user_id = (auth.jwt() ->> 'sub')
  );
$$;

-- 3. Create optimized policies
DROP POLICY IF EXISTS "sync_lists" ON public.lists;
CREATE POLICY "sync_lists" ON public.lists FOR SELECT USING (
  created_by = (auth.jwt() ->> 'sub') OR public.is_list_member(id)
);

DROP POLICY IF EXISTS "sync_items" ON public.items;
CREATE POLICY "sync_items" ON public.items FOR SELECT USING (
  public.is_list_member(list_id)
);

DROP POLICY IF EXISTS "sync_members" ON public.list_users;
CREATE POLICY "sync_members" ON public.list_users FOR SELECT USING (
  user_id = (auth.jwt() ->> 'sub') OR public.is_list_member(list_id)
);

-- 4. Set Replica Identity to FULL for tracked tables
-- This ensures that DELETE events contain all columns (like list_id)
-- so the client knows which list to refresh.
ALTER TABLE public.lists REPLICA IDENTITY FULL;
ALTER TABLE public.items REPLICA IDENTITY FULL;
ALTER TABLE public.list_users REPLICA IDENTITY FULL;

-- 5. Grant SELECT to authenticated role
-- Realtime engine requires the role to have SELECT privilege to evaluate RLS
GRANT SELECT ON public.lists TO authenticated;
GRANT SELECT ON public.items TO authenticated;
GRANT SELECT ON public.list_users TO authenticated;

-- 6. Setup Realtime Publication
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime FOR TABLE public.lists, public.items, public.list_users;
    ELSE
        ALTER PUBLICATION supabase_realtime SET TABLE public.lists, public.items, public.list_users;
    END IF;
END $$;
