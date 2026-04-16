import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAboutFeaturedPosts, useAddFeaturedPost, useUpdateFeaturedPost,
  useDeleteFeaturedPost, useReorderFeaturedPosts, useUploadCmsImage,
} from "@/hooks/use-about-cms";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Link as LinkIcon, GripVertical, Upload, Image } from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RichTextArea } from "@/components/cms/RichTextToolbar";

function RichTextPostDescription({ defaultValue, onSave }: { defaultValue: string; onSave: (v: string | null) => void }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">Description</label>
      <RichTextArea
        value={value}
        onChange={setValue}
        onBlur={() => value !== defaultValue && onSave(value || null)}
        rows={2}
      />
    </div>
  );
}

function SortablePostItem({ post, children }: { post: any; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id });
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

export const CmsFeaturedPostsEditor = () => {
  const { data: posts = [], isLoading } = useAboutFeaturedPosts();
  const addPost = useAddFeaturedPost();
  const updatePost = useUpdateFeaturedPost();
  const deletePost = useDeleteFeaturedPost();
  const reorderPosts = useReorderFeaturedPosts();
  const uploadImage = useUploadCmsImage();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSource, setNewSource] = useState("LinkedIn");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleAdd = async () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    try {
      await addPost.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        url: newUrl.trim(),
        source_label: newSource.trim() || "LinkedIn",
        image_url: null,
        sort_order: posts.length,
      });
      setNewTitle(""); setNewDescription(""); setNewUrl(""); setNewSource("LinkedIn");
      setShowAdd(false);
      toast.success("Post added");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate = async (post: any, field: string, value: string | null) => {
    try {
      await updatePost.mutateAsync({ ...post, [field]: value });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleImageUpload = async (post: any, file: File) => {
    try {
      const url = await uploadImage.mutateAsync({ file, folder: "featured-posts" });
      await handleUpdate(post, "image_url", url);
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = posts.findIndex((p) => p.id === active.id);
    const newIndex = posts.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(posts, oldIndex, newIndex);
    await reorderPosts.mutateAsync(reordered.map((p, i) => ({ id: p.id, sort_order: i })));
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-medium text-muted-foreground">{posts.length} featured post{posts.length !== 1 ? "s" : ""} — Drag to reorder</h2>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Add Post
        </Button>
      </div>

      {showAdd && (
        <Card className="card-elevated border-border border-dashed">
          <CardContent className="p-5 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Post title" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Description</label>
              <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={2} placeholder="Brief description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground flex items-center gap-1"><LinkIcon className="h-3 w-3" /> URL</label>
                <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Source Label</label>
                <Input value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="LinkedIn, GitHub, Medium..." />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={addPost.isPending}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={posts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {posts.map((post) => (
            <SortablePostItem key={post.id} post={post}>
              <Card className="card-elevated border-border">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Title</label>
                        <Input
                          defaultValue={post.title}
                          onBlur={(e) => e.target.value !== post.title && handleUpdate(post, "title", e.target.value)}
                          className="h-8 text-sm font-semibold"
                        />
                      </div>
                      <RichTextPostDescription
                        defaultValue={post.description || ""}
                        onSave={(val) => handleUpdate(post, "description", val)}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground flex items-center gap-1"><LinkIcon className="h-3 w-3" /> URL</label>
                          <Input
                            defaultValue={post.url}
                            onBlur={(e) => e.target.value !== post.url && handleUpdate(post, "url", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">Source Label</label>
                          <Input
                            defaultValue={post.source_label || ""}
                            onBlur={(e) => handleUpdate(post, "source_label", e.target.value || null)}
                            className="h-8 text-sm"
                            placeholder="LinkedIn, GitHub, Medium..."
                          />
                        </div>
                      </div>
                      {/* Image upload */}
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Image className="h-3 w-3" /> Post Image
                        </label>
                        <div className="flex items-center gap-3">
                          {post.image_url && (
                            <img src={post.image_url} alt="Post" className="w-24 h-16 rounded-lg object-cover border border-border" />
                          )}
                          <label>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs cursor-pointer" asChild>
                              <span><Upload className="h-3.5 w-3.5" />{post.image_url ? "Change" : "Upload"}</span>
                            </Button>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageUpload(post, f);
                            }} />
                          </label>
                          {post.image_url && (
                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => handleUpdate(post, "image_url", null)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        await deletePost.mutateAsync(post.id);
                        toast.success("Post removed");
                      }}
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {post.url && (
                    <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3 w-3" />
                      Preview link
                    </a>
                  )}
                </CardContent>
              </Card>
            </SortablePostItem>
          ))}
        </SortableContext>
      </DndContext>

      {posts.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">No featured posts yet</div>
      )}
    </div>
  );
};
