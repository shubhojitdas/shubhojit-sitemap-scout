import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAboutSkills, useAddSkill, useUpdateSkill, useDeleteSkill, useReorderSkills } from "@/hooks/use-about-cms";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ICON_OPTIONS = [
  "Code", "Wrench", "FileCode", "Search", "Globe", "BarChart3",
  "Zap", "Layout", "Database", "Shield", "Cpu", "Terminal",
  "Link", "Settings", "Monitor", "Smartphone", "Server", "Cloud",
];

function SortableSkillItem({ skill, onUpdate, onDelete }: {
  skill: any;
  onUpdate: (skill: any, field: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: skill.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      </button>
      <Input
        defaultValue={skill.name}
        onBlur={(e) => e.target.value !== skill.name && onUpdate(skill, "name", e.target.value)}
        className="flex-1 h-8 text-sm"
      />
      <Select defaultValue={skill.icon_name} onValueChange={(v) => onUpdate(skill, "icon_name", v)}>
        <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          {ICON_OPTIONS.map((icon) => (
            <SelectItem key={icon} value={icon}>{icon}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" onClick={() => onDelete(skill.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export const CmsSkillsEditor = () => {
  const { data: skills = [], isLoading } = useAboutSkills();
  const addSkill = useAddSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();
  const reorderSkills = useReorderSkills();

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("Code");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = skills.findIndex((s) => s.id === active.id);
    const newIndex = skills.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(skills, oldIndex, newIndex);
    const updates = reordered.map((s, i) => ({ id: s.id, sort_order: i }));
    await reorderSkills.mutateAsync(updates);
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
          <CardTitle className="text-sm">Current Skills ({skills.length}) — Drag to reorder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={skills.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {skills.map((skill) => (
                <SortableSkillItem key={skill.id} skill={skill} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
            </SortableContext>
          </DndContext>
          {skills.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No skills added yet</p>}
        </CardContent>
      </Card>
    </div>
  );
};
