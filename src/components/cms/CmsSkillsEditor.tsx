import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAboutSkills, useAddSkill, useUpdateSkill, useDeleteSkill } from "@/hooks/use-about-cms";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";

const ICON_OPTIONS = [
  "Code", "Wrench", "FileCode", "Search", "Globe", "BarChart3",
  "Zap", "Layout", "Database", "Shield", "Cpu", "Terminal",
  "Link", "Settings", "Monitor", "Smartphone", "Server", "Cloud",
];

export const CmsSkillsEditor = () => {
  const { data: skills = [], isLoading } = useAboutSkills();
  const addSkill = useAddSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("Code");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await addSkill.mutateAsync({ name: newName.trim(), icon_name: newIcon, sort_order: skills.length });
      setNewName("");
      toast.success("Skill added");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSkill.mutateAsync(id);
      toast.success("Skill removed");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate = async (skill: any, field: string, value: string) => {
    try {
      await updateSkill.mutateAsync({ ...skill, [field]: value });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card className="card-elevated border-border">
        <CardHeader>
          <CardTitle className="text-sm">Add New Skill</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Skill name" className="flex-1" onKeyDown={(e) => e.key === "Enter" && handleAdd()} />
            <Select value={newIcon} onValueChange={setNewIcon}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((icon) => (
                  <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={addSkill.isPending} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-elevated border-border">
        <CardHeader>
          <CardTitle className="text-sm">Current Skills ({skills.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {skills.map((skill) => (
            <div key={skill.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              <Input
                defaultValue={skill.name}
                onBlur={(e) => e.target.value !== skill.name && handleUpdate(skill, "name", e.target.value)}
                className="flex-1 h-8 text-sm"
              />
              <Select defaultValue={skill.icon_name} onValueChange={(v) => handleUpdate(skill, "icon_name", v)}>
                <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(skill.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {skills.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No skills added yet</p>}
        </CardContent>
      </Card>
    </div>
  );
};
