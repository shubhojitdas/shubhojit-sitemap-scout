import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useAboutExperience,
  useAddExperience,
  useUpdateExperience,
  useDeleteExperience,
  useAddAchievement,
  useDeleteAchievement,
  useUpdateAchievement,
  useReorderExperience,
  useUploadCmsImage,
  type AboutExperience,
} from "@/hooks/use-about-cms";
import { toast } from "sonner";
import { Plus, Trash2, Award, ChevronDown, ChevronUp, Link as LinkIcon, Upload, GripVertical, Image } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RichTextToolbar } from "@/components/cms/RichTextToolbar";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => String(currentYear - i));

function formatPeriod(startDate: string | null, endDate: string | null, isCurrent: boolean): string {
  if (!startDate) return "";
  const fmt = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  };
  const start = fmt(startDate);
  const end = isCurrent ? "Present" : endDate ? fmt(endDate) : "";
  return end ? `${start} – ${end}` : start;
}

function DateSelector({ label, month, year, onMonthChange, onYearChange }: {
  label: string; month: string; year: string;
  onMonthChange: (v: string) => void; onYearChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <Select value={month} onValueChange={onMonthChange}>
          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={onYearChange}>
          <SelectTrigger className="h-8 text-xs w-24"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function SortableExpItem({ exp, children }: { exp: AboutExperience; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exp.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-start gap-1">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none mt-4 p-1">
          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
        </button>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

export const CmsExperienceEditor = () => {
  const { data: experiences = [], isLoading } = useAboutExperience();
  const addExperience = useAddExperience();
  const updateExperience = useUpdateExperience();
  const deleteExperience = useDeleteExperience();
  const addAchievement = useAddAchievement();
  const updateAchievement = useUpdateAchievement();
  const deleteAchievement = useDeleteAchievement();
  const reorderExperience = useReorderExperience();
  const uploadImage = useUploadCmsImage();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFeaturedUrl, setNewFeaturedUrl] = useState("");
  const [newFeaturedTitle, setNewFeaturedTitle] = useState("");
  const [newStartMonth, setNewStartMonth] = useState("");
  const [newStartYear, setNewStartYear] = useState("");
  const [newEndMonth, setNewEndMonth] = useState("");
  const [newEndYear, setNewEndYear] = useState("");
  const [newIsCurrent, setNewIsCurrent] = useState(false);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const buildDate = (month: string, year: string) => {
    if (!month || !year) return null;
    return `${year}-${String(Number(month) + 1).padStart(2, "0")}-01`;
  };

  const handleAddExperience = async () => {
    if (!newRole.trim() || !newCompany.trim()) return;
    const startDate = buildDate(newStartMonth, newStartYear);
    const endDate = newIsCurrent ? null : buildDate(newEndMonth, newEndYear);
    const period = formatPeriod(startDate, endDate, newIsCurrent);
    
    try {
      await addExperience.mutateAsync({
        role: newRole.trim(),
        company: newCompany.trim(),
        period: period || "Present",
        description: newDescription.trim() || null,
        featured_post_url: newFeaturedUrl.trim() || null,
        featured_post_title: newFeaturedTitle.trim() || null,
        image_url: null,
        start_date: startDate,
        end_date: endDate,
        is_current: newIsCurrent,
        sort_order: experiences.length,
      });
      setNewRole(""); setNewCompany(""); setNewDescription("");
      setNewFeaturedUrl(""); setNewFeaturedTitle("");
      setNewStartMonth(""); setNewStartYear("");
      setNewEndMonth(""); setNewEndYear("");
      setNewIsCurrent(false);
      setShowAddForm(false);
      toast.success("Experience added");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateField = async (exp: AboutExperience, field: string, value: any) => {
    try {
      const { achievements, ...rest } = exp;
      const updated = { ...rest, [field]: value ?? null };
      
      // Auto-recalculate period when date fields change
      if (field === "start_date" || field === "end_date" || field === "is_current") {
        updated.period = formatPeriod(updated.start_date, updated.end_date, updated.is_current) || updated.period;
      }
      
      await updateExperience.mutateAsync(updated);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleImageUpload = async (exp: AboutExperience, file: File) => {
    try {
      const url = await uploadImage.mutateAsync({ file, folder: "experience" });
      await handleUpdateField(exp, "image_url", url);
      toast.success("Image uploaded");
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = experiences.findIndex((e) => e.id === active.id);
    const newIndex = experiences.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(experiences, oldIndex, newIndex);
    await reorderExperience.mutateAsync(reordered.map((e, i) => ({ id: e.id, sort_order: i })));
  };

  const parseDateParts = (dateStr: string | null) => {
    if (!dateStr) return { month: "", year: "" };
    const d = new Date(dateStr + "T00:00:00");
    return { month: String(d.getMonth()), year: String(d.getFullYear()) };
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-medium text-muted-foreground">
          {experiences.length} organization{experiences.length !== 1 ? "s" : ""} — Drag to reorder
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
            <div className="grid grid-cols-2 gap-3">
              <DateSelector label="Start Date" month={newStartMonth} year={newStartYear} onMonthChange={setNewStartMonth} onYearChange={setNewStartYear} />
              {!newIsCurrent && (
                <DateSelector label="End Date" month={newEndMonth} year={newEndYear} onMonthChange={setNewEndMonth} onYearChange={setNewEndYear} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="is-current-new" checked={newIsCurrent} onCheckedChange={(v) => setNewIsCurrent(!!v)} />
              <label htmlFor="is-current-new" className="text-xs text-muted-foreground cursor-pointer">I am currently working in this role</label>
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={experiences.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          {experiences.map((exp) => {
            const startParts = parseDateParts(exp.start_date);
            const endParts = parseDateParts(exp.end_date);

            return (
              <SortableExpItem key={exp.id} exp={exp}>
                <Collapsible
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
                          <div className="text-xs text-muted-foreground">{exp.period}</div>
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
                        {/* Date selectors */}
                        <div className="grid grid-cols-2 gap-3">
                          <DateSelector
                            label="Start Date"
                            month={startParts.month}
                            year={startParts.year}
                            onMonthChange={(m) => handleUpdateField(exp, "start_date", buildDate(m, startParts.year || String(currentYear)))}
                            onYearChange={(y) => handleUpdateField(exp, "start_date", buildDate(startParts.month || "0", y))}
                          />
                          {!exp.is_current && (
                            <DateSelector
                              label="End Date"
                              month={endParts.month}
                              year={endParts.year}
                              onMonthChange={(m) => handleUpdateField(exp, "end_date", buildDate(m, endParts.year || String(currentYear)))}
                              onYearChange={(y) => handleUpdateField(exp, "end_date", buildDate(endParts.month || "0", y))}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`is-current-${exp.id}`}
                            checked={exp.is_current}
                            onCheckedChange={(v) => handleUpdateField(exp, "is_current", !!v)}
                          />
                          <label htmlFor={`is-current-${exp.id}`} className="text-xs text-muted-foreground cursor-pointer">
                            I am currently working in this role
                          </label>
                        </div>

                        <RichTextDescription
                          defaultValue={exp.description || ""}
                          onSave={(val) => handleUpdateField(exp, "description", val)}
                        />

                        {/* Featured image */}
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Image className="h-3 w-3" /> Featured Image
                          </label>
                          <div className="flex items-center gap-3">
                            {exp.image_url && (
                              <img src={exp.image_url} alt="Featured" className="w-24 h-16 rounded-lg object-cover border border-border" />
                            )}
                            <label>
                              <Button variant="outline" size="sm" className="gap-1.5 text-xs cursor-pointer" asChild>
                                <span><Upload className="h-3.5 w-3.5" />{exp.image_url ? "Change" : "Upload"}</span>
                              </Button>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleImageUpload(exp, f);
                              }} />
                            </label>
                            {exp.image_url && (
                              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => handleUpdateField(exp, "image_url", null)}>
                                Remove
                              </Button>
                            )}
                          </div>
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
              </SortableExpItem>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
};
