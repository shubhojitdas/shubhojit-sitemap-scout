import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LogOut, User, Code, Briefcase, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CmsProfileEditor } from "@/components/cms/CmsProfileEditor";
import { CmsSkillsEditor } from "@/components/cms/CmsSkillsEditor";
import { CmsExperienceEditor } from "@/components/cms/CmsExperienceEditor";
import { CmsFeaturedPostsEditor } from "@/components/cms/CmsFeaturedPostsEditor";

const CmsDashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAdmin = async (sess: any) => {
      if (!sess) {
        navigate("/cms/login");
        return;
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", sess.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error || !data) {
        await supabase.auth.signOut();
        toast.error("Access denied");
        navigate("/cms/login");
        return;
      }
      setSession(sess);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      verifyAdmin(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      verifyAdmin(session);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/cms/login");
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">Loading...</div>;
  if (!session) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 grid-bg fade-mask pointer-events-none" />
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/shubhojit-das" target="_blank">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
                View Page
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-xs text-muted-foreground">
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Content Manager</h1>
          <p className="text-sm text-muted-foreground">Manage your About page content</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="gap-1.5 text-xs">
              <User className="h-3.5 w-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-1.5 text-xs">
              <Code className="h-3.5 w-3.5" />
              Skills
            </TabsTrigger>
            <TabsTrigger value="experience" className="gap-1.5 text-xs">
              <Briefcase className="h-3.5 w-3.5" />
              Experience
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-1.5 text-xs">
              <Heart className="h-3.5 w-3.5" />
              Posts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <CmsProfileEditor />
          </TabsContent>
          <TabsContent value="skills">
            <CmsSkillsEditor />
          </TabsContent>
          <TabsContent value="experience">
            <CmsExperienceEditor />
          </TabsContent>
          <TabsContent value="posts">
            <CmsFeaturedPostsEditor />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CmsDashboard;
