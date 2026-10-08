import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

type Plan = 'free' | 'plus';

export type Gender = 'female' | 'male' | 'nonbinary' | 'prefer_not';

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  locale: string;
  gender: Gender | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  plan: Plan;
  has_completed_onboarding: boolean;
};

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (patch: Partial<Omit<Profile, 'id' | 'plan'>>) => Promise<void>;
  uploadAvatar: (localUri: string) => Promise<string | null>;
  removeAvatar: () => Promise<void>;
  // Sube el plan a Plus. En producción lo confirmaría el servidor tras el pago; aquí es directo para el MVP.
  upgradeToPlus: () => Promise<boolean>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const userId = session!.user.id;

      // La fila de perfil la crea un trigger en el signup; en cuentas nuevas puede
      // tardar unos cientos de ms, así que reintentamos antes de rendirnos.
      let data: Profile | null = null;
      for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
        const res = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (res.data) { data = res.data as Profile; break; }
        await new Promise((r) => setTimeout(r, 400));
      }

      if (cancelled) return;
      if (data) setProfile(data);
      setLoading(false);
    }

    load();

    return () => { cancelled = true; };
  }, [session?.user.id]);

  async function updateProfile(patch: Partial<Omit<Profile, 'id' | 'plan'>>) {
    if (!profile) return;
    const prev = profile;
    setProfile({ ...profile, ...patch });

    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', profile.id);

    if (error) {
      console.error('Update profile error', error);
      setProfile(prev);
    }
  }

  async function uploadAvatar(localUri: string): Promise<string | null> {
    if (!profile) return null;
    try {
      const response = await fetch(localUri);
      const arrayBuffer = await response.arrayBuffer();
      const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
      // Timestamp en la ruta para cache-bust del CDN.
      const path = `${profile.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType, upsert: true });

      if (uploadError) {
        console.error('Upload avatar error', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      await updateProfile({ avatar_url: publicUrl });
      return publicUrl;
    } catch (err) {
      console.error('Upload avatar exception', err);
      return null;
    }
  }

  async function removeAvatar() {
    if (!profile) return;
    await updateProfile({ avatar_url: null });
  }

  async function upgradeToPlus(): Promise<boolean> {
    if (!profile) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ plan: 'plus' })
      .eq('id', profile.id);
    if (error) {
      console.error('upgradeToPlus error', error);
      return false;
    }
    setProfile({ ...profile, plan: 'plus' });
    return true;
  }

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile, uploadAvatar, removeAvatar, upgradeToPlus }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
