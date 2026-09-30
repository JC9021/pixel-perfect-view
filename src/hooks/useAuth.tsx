import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DemoUser {
  id: string;
  email: string;
  user_metadata: { display_name?: string };
}

interface DemoSession {
  user: DemoUser;
  access_token: string;
}

interface AuthValue {
  user: DemoUser | null;
  session: DemoSession | null;
  loading: boolean;
}

const AuthContext = createContext<AuthValue>({ user: null, session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      setSession(data.session);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
