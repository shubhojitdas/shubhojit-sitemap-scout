import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAboutProfile, useUpdateProfile, useUploadProfileImage } from "@/hooks/use-about-cms";
import { toast } from "sonner";
import { Save, Upload, Plus, Trash2, Image } from "lucide-react";
import { RichTextToolbar } from "@/components/cms/RichTextToolbar";

function ParagraphEditor({ value, onChange, onRemove }: { value: string; onChange: (v: string) => void; onRemove: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-1.5">
      <RichTextToolbar textareaRef={ref} value={value} onChange={onChange} />
      <div className="flex gap-2">
        <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="text-sm flex-1 font-mono" />
        <Button variant="ghost" size="icon" onClick={onRemove} className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export const CmsProfileEditor = () => {
  const { data: profile, isLoading } = useAboutProfile();
  const updateProfile = useUpdateProfile();
  const uploadImage = useUploadProfileImage();

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [paragraphs, setParagraphs] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setTitle(profile.title);
      setLinkedinUrl(profile.linkedin_url || "");
      setParagraphs(profile.about_paragraphs || []);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    try {
      await updateProfile.mutateAsync({
        id: profile.id,
        name,
        title,
        linkedin_url: linkedinUrl,
        about_paragraphs: paragraphs,
      });
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      await uploadImage.mutateAsync({ file, profileId: profile.id });
      toast.success("Photo updated");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateParagraph = (index: number, value: string) => {
    const updated = [...paragraphs];
    updated[index] = value;
    setParagraphs(updated);
  };

  const addParagraph = () => setParagraphs([...paragraphs, ""]);
  const removeParagraph = (index: number) => setParagraphs(paragraphs.filter((_, i) => i !== index));

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card className="card-elevated border-border">
        <CardHeader>
          <CardTitle className="text-sm">Profile Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {profile?.image_url ? (
              <img src={profile.image_url} alt="Profile" className="w-28 h-28 rounded-xl object-cover border border-border" />
            ) : (
              <div className="w-28 h-28 rounded-xl bg-muted flex items-center justify-center border border-border">
                <Image className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <label htmlFor="photo-upload">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs cursor-pointer" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5" />
                    Upload Photo
                  </span>
                </Button>
              </label>
              <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG. Recommended 400×400</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated border-border">
        <CardHeader>
          <CardTitle className="text-sm">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Title / Tagline</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">LinkedIn URL</label>
            <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">About Paragraphs</CardTitle>
          <Button variant="outline" size="sm" onClick={addParagraph} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Paragraph
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {paragraphs.map((p, i) => (
            <ParagraphEditor key={i} value={p} onChange={(v) => updateParagraph(i, v)} onRemove={() => removeParagraph(i)} />
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateProfile.isPending} className="gap-1.5">
          <Save className="h-4 w-4" />
          {updateProfile.isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </div>
  );
};
