import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type Symptom = {
  id: string;
  key: string;
  names: Record<string, string>;
  category: 'physical' | 'cognitive' | 'emotional' | null;
  position: number;
};

export type UserSymptom = {
  id: string;
  symptom_id: string | null;
  custom_label: string | null;
};

type SymptomsContextValue = {
  catalog: Symptom[];
  userSymptoms: UserSymptom[];
  loading: boolean;
  hasSymptoms: boolean;
  addPreset: (symptomId: string) => Promise<void>;
  addCustom: (label: string) => Promise<void>;
  remove: (userSymptomId: string) => Promise<void>;
};

const SymptomsContext = createContext<SymptomsContextValue | null>(null);


export function resolveSymptomName(symptom: Symptom, locale: string = 'es-PE'): string {
  const lang = locale.split('-')[0];
  return symptom.names[lang] || symptom.names.es || symptom.key;
}

export function SymptomsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [catalog, setCatalog] = useState<Symptom[]>([]);
  const [userSymptoms, setUserSymptoms] = useState<UserSymptom[]>([]);
  const [loading, setLoading] = useState(true);

 
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('symptoms')
      .select('*')
      .order('position')
      .then(({ data }) => {
        if (!cancelled && data) setCatalog(data as Symptom[]);
      });
    return () => { cancelled = true; };
  }, []);

 
  useEffect(() => {
    if (!session?.user.id) {
      setUserSymptoms([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('user_symptoms')
      .select('id, symptom_id, custom_label')
      .eq('user_id', session.user.id)
      .order('created_at')
      .then(({ data }) => {
        if (cancelled) return;
        if (data) setUserSymptoms(data as UserSymptom[]);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [session?.user.id]);

  const addPreset = useCallback(async (symptomId: string) => {
    const userId = session?.user.id;
    if (!userId) return;
  
    if (userSymptoms.some((s) => s.symptom_id === symptomId)) return;

    const { data, error } = await supabase
      .from('user_symptoms')
      .insert({ user_id: userId, symptom_id: symptomId })
      .select('id, symptom_id, custom_label')
      .single();

    if (error) {
      console.error('Add preset symptom error', error);
      return;
    }
    setUserSymptoms((prev) => [...prev, data as UserSymptom]);
  }, [session?.user.id, userSymptoms]);

  const addCustom = useCallback(async (label: string) => {
    const userId = session?.user.id;
    const trimmed = label.trim();
    if (!userId || !trimmed) return;
    
    if (userSymptoms.some((s) => s.custom_label?.toLowerCase() === trimmed.toLowerCase())) return;

    const { data, error } = await supabase
      .from('user_symptoms')
      .insert({ user_id: userId, custom_label: trimmed })
      .select('id, symptom_id, custom_label')
      .single();

    if (error) {
      console.error('Add custom symptom error', error);
      return;
    }
    setUserSymptoms((prev) => [...prev, data as UserSymptom]);
  }, [session?.user.id, userSymptoms]);

  const remove = useCallback(async (userSymptomId: string) => {
    const prev = userSymptoms;
    setUserSymptoms((cur) => cur.filter((s) => s.id !== userSymptomId));

    const { error } = await supabase
      .from('user_symptoms')
      .delete()
      .eq('id', userSymptomId);

    if (error) {
      console.error('Remove symptom error', error);
      setUserSymptoms(prev);
    }
  }, [userSymptoms]);

  return (
    <SymptomsContext.Provider
      value={{
        catalog,
        userSymptoms,
        loading,
        hasSymptoms: userSymptoms.length > 0,
        addPreset,
        addCustom,
        remove,
      }}
    >
      {children}
    </SymptomsContext.Provider>
  );
}

export function useSymptoms() {
  const ctx = useContext(SymptomsContext);
  if (!ctx) throw new Error('useSymptoms must be used within SymptomsProvider');
  return ctx;
}
