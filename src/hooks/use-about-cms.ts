import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types
export interface AboutProfile {
  id: string;
  name: string;
  title: string;
  about_paragraphs: string[];
  linkedin_url: string | null;
  image_url: string | null;
  updated_at: string;
}

export interface AboutSkill {
  id: string;
  name: string;
  icon_name: string;
  sort_order: number;
}

export interface AboutExperienceAchievement {
  id: string;
  experience_id: string;
  text: string;
  sort_order: number;
}

export interface AboutExperience {
  id: string;
  role: string;
  company: string;
  period: string;
  description: string | null;
  featured_post_url: string | null;
  featured_post_title: string | null;
  sort_order: number;
  achievements?: AboutExperienceAchievement[];
}

export interface AboutFeaturedPost {
  id: string;
  title: string;
  description: string | null;
  url: string;
  source_label: string | null;
  sort_order: number;
}

// Fetch hooks
export function useAboutProfile() {
  return useQuery({
    queryKey: ["about-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("about_profile")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data as AboutProfile;
    },
  });
}

export function useAboutSkills() {
  return useQuery({
    queryKey: ["about-skills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("about_skills")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as AboutSkill[];
    },
  });
}

export function useAboutExperience() {
  return useQuery({
    queryKey: ["about-experience"],
    queryFn: async () => {
      const { data: experiences, error: expError } = await supabase
        .from("about_experience")
        .select("*")
        .order("sort_order");
      if (expError) throw expError;

      const { data: achievements, error: achError } = await supabase
        .from("about_experience_achievements")
        .select("*")
        .order("sort_order");
      if (achError) throw achError;

      return (experiences as AboutExperience[]).map((exp) => ({
        ...exp,
        achievements: (achievements as AboutExperienceAchievement[]).filter(
          (a) => a.experience_id === exp.id
        ),
      }));
    },
  });
}

export function useAboutFeaturedPosts() {
  return useQuery({
    queryKey: ["about-featured-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("about_featured_posts")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as AboutFeaturedPost[];
    },
  });
}

// Mutation hooks
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<AboutProfile> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await supabase
        .from("about_profile")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-profile"] }),
  });
}

export function useUploadProfileImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, profileId }: { file: File; profileId: string }) => {
      const ext = file.name.split(".").pop();
      const path = `profile-photo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("profile-images")
        .getPublicUrl(path);

      const { error } = await supabase
        .from("about_profile")
        .update({ image_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", profileId);
      if (error) throw error;
      return urlData.publicUrl;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-profile"] }),
  });
}

// Skills mutations
export function useAddSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skill: Omit<AboutSkill, "id">) => {
      const { error } = await supabase.from("about_skills").insert(skill);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-skills"] }),
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skill: AboutSkill) => {
      const { id, ...rest } = skill;
      const { error } = await supabase.from("about_skills").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-skills"] }),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("about_skills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-skills"] }),
  });
}

// Experience mutations
export function useAddExperience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (exp: Omit<AboutExperience, "id" | "achievements">) => {
      const { error } = await supabase.from("about_experience").insert(exp);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-experience"] }),
  });
}

export function useUpdateExperience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (exp: Omit<AboutExperience, "achievements">) => {
      const { id, ...rest } = exp;
      const { error } = await supabase.from("about_experience").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-experience"] }),
  });
}

export function useDeleteExperience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("about_experience").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-experience"] }),
  });
}

// Achievement mutations
export function useAddAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (achievement: Omit<AboutExperienceAchievement, "id">) => {
      const { error } = await supabase.from("about_experience_achievements").insert(achievement);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-experience"] }),
  });
}

export function useUpdateAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: AboutExperienceAchievement) => {
      const { id, ...rest } = a;
      const { error } = await supabase.from("about_experience_achievements").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-experience"] }),
  });
}

export function useDeleteAchievement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("about_experience_achievements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-experience"] }),
  });
}

// Featured posts mutations
export function useAddFeaturedPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: Omit<AboutFeaturedPost, "id">) => {
      const { error } = await supabase.from("about_featured_posts").insert(post);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-featured-posts"] }),
  });
}

export function useUpdateFeaturedPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: AboutFeaturedPost) => {
      const { id, ...rest } = post;
      const { error } = await supabase.from("about_featured_posts").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-featured-posts"] }),
  });
}

export function useDeleteFeaturedPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("about_featured_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["about-featured-posts"] }),
  });
}
