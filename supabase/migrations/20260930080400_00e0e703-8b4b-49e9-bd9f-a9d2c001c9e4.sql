
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Roommate',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), NULLIF(NEW.raw_user_meta_data->>'full_name',''), split_part(NEW.email, '@', 1), 'Roommate'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- HOUSEHOLDS
CREATE TABLE public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  rotation_enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- MEMBERS
CREATE TABLE public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  color TEXT NOT NULL DEFAULT 'teal',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT ALL ON public.household_members TO service_role;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_household_member(_household_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = _household_id AND user_id = _user_id
  );
$$;

CREATE POLICY "households_select_member" ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "households_insert_own" ON public.households FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "households_update_member" ON public.households FOR UPDATE TO authenticated
  USING (public.is_household_member(id, auth.uid())) WITH CHECK (public.is_household_member(id, auth.uid()));
CREATE POLICY "households_delete_owner" ON public.households FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "members_select" ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(household_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "members_insert_self" ON public.household_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "members_delete" ON public.household_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.households h WHERE h.id = household_id AND h.created_by = auth.uid()));

-- CHORES
CREATE TABLE public.chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  room TEXT,
  icon TEXT,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  custom_days INTEGER,
  estimated_minutes INTEGER NOT NULL DEFAULT 15,
  difficulty INTEGER NOT NULL DEFAULT 2,
  recurring BOOLEAN NOT NULL DEFAULT true,
  deadline DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chores_difficulty_range CHECK (difficulty BETWEEN 1 AND 3),
  CONSTRAINT chores_frequency_valid CHECK (frequency IN ('daily','weekly','biweekly','monthly','custom'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chores TO authenticated;
GRANT ALL ON public.chores TO service_role;
ALTER TABLE public.chores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chores_all_member" ON public.chores FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- ASSIGNMENTS
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  chore_id UUID NOT NULL REFERENCES public.chores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  due_date DATE NOT NULL,
  points NUMERIC NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX assignments_household_week_idx ON public.assignments (household_id, week_start);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments_all_member" ON public.assignments FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- SWAPS
CREATE TABLE public.swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  target_assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT swap_status_valid CHECK (status IN ('pending','approved','declined'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swap_requests TO authenticated;
GRANT ALL ON public.swap_requests TO service_role;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swaps_all_member" ON public.swap_requests FOR ALL TO authenticated
  USING (public.is_household_member(household_id, auth.uid()))
  WITH CHECK (public.is_household_member(household_id, auth.uid()));

-- JOIN BY INVITE CODE
CREATE OR REPLACE FUNCTION public.join_household_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hh UUID;
  _count INTEGER;
  _colors TEXT[] := ARRAY['teal','amber','plum','rose','accent'];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  SELECT id INTO _hh FROM public.households WHERE upper(invite_code) = upper(trim(_code));
  IF _hh IS NULL THEN
    RAISE EXCEPTION 'No household found with that invite code';
  END IF;
  SELECT count(*) INTO _count FROM public.household_members WHERE household_id = _hh;
  INSERT INTO public.household_members (household_id, user_id, color)
  VALUES (_hh, auth.uid(), _colors[(_count % 5) + 1])
  ON CONFLICT (household_id, user_id) DO NOTHING;
  RETURN _hh;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_household_by_code(TEXT) TO authenticated;
