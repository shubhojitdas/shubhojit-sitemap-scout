import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAboutExperience,
  useAddExperience,
  useUpdateExperience,
  useDeleteExperience,
  useAddAchievement,
  useDeleteAchievement,
  useUpdateAchievement,
  type AboutExperience,
} from "@/hooks/use-about-cms";
import { toast } from "sonner";
import { Plus, Trash2, Award, ChevronDown, ChevronUp, Link as LinkIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const CmsExperienceEditor = () => {
  const { data: experiences = [], isLoading } = useAboutExperience();
  const addExperience = useAddExperience();
  const updateExperience = useUpdateExperience();
  const deleteExperience = useDeleteExperience();
  const addAchievement = useAddAchievement();
  const updateAchievement = useUpdateAchievement();
  const deleteAchievement = useDeleteAchievement();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newPeriod, setNewPeriod] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFeaturedUrl, setNewFeaturedUrl] = useState("");
  const [newFeaturedTitle, setNewFeaturedTitle] = useState("");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const handleAddExperience = async () => {
    if (!newRole.trim() || !newCompany.trim() || !newPeriod.trim()) return;
    try {
      await addExperience.mutateAsync({
        role: newRole.trim(),
        company: newCompany.trim(),
        period: newPeriod.trim(),
        description: newDescription.trim() || null,
        featured_post_url: newFeaturedUrl.trim() || null,
        featured_post_title: newFeaturedTitle.trim() || null,
        sort_order: experiences.length,
      });
      setNewRole(""); setNewCompany(""); setNewPeriod("");
      setNewDescription(""); setNewFeaturedUrl(""); setNewFeaturedTitle("");
      setShowAddForm(false);
      toast.success("Experience added");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateField = async (exp: AboutExperience, field: string, value: string) => {
    try {
      const { achievements, ...rest } = exp;
      await updateExperience.mutateAsync({ ...rest, [field]: value || null });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddAchievement = async (experienceId: string) => {
    try {
      const existing = experiences.find((e) => e.id === experienceId);
      await addAchievement.mutateAsync({
        experience_id: experienceId,
        text: "New achievement",
        sort_order: existing?.achievements?.length || 0,
      });
      toast.success("Achievement added");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-medium text-muted-foreground">
          {experiences.length} organization{experiences.length !== 1 ? "s" : ""}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Add Organization
        </Button>
      </div>

      {showAddForm && (
        <Card className="card-elevated border-border border-dashed">
          <CardContent className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Role / Position</label>
                <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="SEO Specialist" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Company</label>
                <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Company Name" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Period</label>
              <Input value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)} placeholder="2023 – Current" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Description (optional)</label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Featured Post Title (optional)</label>
                <Input value={newFeaturedTitle} onChange={(e) => setNewFeaturedTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Featured Post URL (optional)</label>
                <Input value={newFeaturedUrl} onChange={(e) => setNewFeaturedUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddExperience} disabled={addExperience.isPending}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {experiences.map((exp) => (
        <Collapsible
          key={exp.id}
          open={openItems[exp.id] ?? false}
          onOpenChange={(open) => setOpenItems({ ...openItems, [exp.id]: open })}
        >
          <Card className="card-elevated border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      defaultValue={exp.role}
                      onBlur={(e) => e.target.value !== exp.role && handleUpdateField(exp, "role", e.target.value)}
                      className="h-8 text-sm font-semibold"
                    />
                    <Input
                      defaultValue={exp.company}
                      onBlur={(e) => e.target.value !== exp.company && handleUpdateField(exp, "company", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <Input
                    defaultValue={exp.period}
                    onBlur={(e) => e.target.value !== exp.period && handleUpdateField(exp, "period", e.target.value)}
                    className="h-8 text-xs w-48"
                  />
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      {openItems[exp.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await deleteExperience.mutateAsync(exp.id);
                      toast.success("Removed");
                    }}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Description</label>
                  <Textarea
                    defaultValue={exp.description || ""}
                    onBlur={(e) => handleUpdateField(exp, "description", e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" /> Featured Post Title
                    </label>
                    <Input
                      defaultValue={exp.featured_post_title || ""}
                      onBlur={(e) => handleUpdateField(exp, "featured_post_title", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" /> Featured Post URL
                    </label>
                    <Input
                      defaultValue={exp.featured_post_url || ""}
                      onBlur={(e) => handleUpdateField(exp, "featured_post_url", e.target.value)}
                      className="h-8 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Achievements */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Award className="h-3 w-3" /> Achievements
                    </label>
                    <Button variant="outline" size="sm" onClick={() => handleAddAchievement(exp.id)} className="gap-1 text-[10px] h-7">
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                  {exp.achievements?.map((a) => (
                    <div key={a.id} className="flex items-start gap-2">
                      <Input
                        defaultValue={a.text}
                        onBlur={(e) => e.target.value !== a.text && updateAchievement.mutateAsync({ ...a, text: e.target.value })}
                        className="flex-1 h-8 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAchievement.mutateAsync(a.id).then(() => toast.success("Removed"))}
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
};
