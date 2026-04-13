import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAboutFeaturedPosts, useAddFeaturedPost, useUpdateFeaturedPost, useDeleteFeaturedPost } from "@/hooks/use-about-cms";
import { toast } from "sonner";
import { Plus, Trash2, ExternalLink, Link as LinkIcon } from "lucide-react";

export const CmsFeaturedPostsEditor = () => {
  const { data: posts = [], isLoading } = useAboutFeaturedPosts();
  const addPost = useAddFeaturedPost();
  const updatePost = useUpdateFeaturedPost();
  const deletePost = useDeleteFeaturedPost();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSource, setNewSource] = useState("LinkedIn");

  const handleAdd = async () => {
    if (!newTitle.trim() || !newUrl.trim()) return;
    try {
      await addPost.mutateAsync({
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        url: newUrl.trim(),
        source_label: newSource.trim() || "LinkedIn",
        sort_order: posts.length,
      });
      setNewTitle(""); setNewDescription(""); setNewUrl(""); setNewSource("LinkedIn");
      setShowAdd(false);
      toast.success("Post added");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdate = async (post: any, field: string, value: string) => {
    try {
      await updatePost.mutateAsync({ ...post, [field]: value || null });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-medium text-muted-foreground">{posts.length} featured post{posts.length !== 1 ? "s" : ""}</h2>
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
                <label className="text-xs text-muted-foreground flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" /> URL
                </label>
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

      {posts.map((post) => (
        <Card key={post.id} className="card-elevated border-border">
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
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Description</label>
                  <Textarea
                    defaultValue={post.description || ""}
                    onBlur={(e) => handleUpdate(post, "description", e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" /> URL
                    </label>
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
                      onBlur={(e) => handleUpdate(post, "source_label", e.target.value)}
                      className="h-8 text-sm"
                      placeholder="LinkedIn, GitHub, Medium..."
                    />
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
      ))}

      {posts.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">No featured posts yet</div>
      )}
    </div>
  );
};
