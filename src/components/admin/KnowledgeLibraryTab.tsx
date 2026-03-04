import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Search, FileText, Globe, Upload, Trash2, ExternalLink, Plus, Loader2, Link, FileUp, ChevronRight, Eye } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface KnowledgeDocument {
  id: string;
  title: string;
  source_type: string;
  source_url: string | null;
  file_path: string | null;
  status: string;
  total_chunks: number | null;
  created_at: string;
  updated_at: string;
  uploaded_by: string;
  organization_id: string;
  content_text: string | null;
  metadata: any;
  org_name?: string;
  uploader_name?: string;
}

const sourceTypeIcon = (type: string) => {
  switch (type) {
    case 'url': return <Globe className="h-3.5 w-3.5" />;
    case 'pdf':
    case 'file': return <FileUp className="h-3.5 w-3.5" />;
    default: return <FileText className="h-3.5 w-3.5" />;
  }
};

const statusVariant = (status: string) => {
  switch (status) {
    case 'processed': return 'default' as const;
    case 'pending': return 'secondary' as const;
    case 'processing': return 'secondary' as const;
    case 'error': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

export default function KnowledgeLibraryTab() {
  const { user, currentOrg } = useAuth();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<KnowledgeDocument | null>(null);

  const { data: documents = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-knowledge-documents'],
    queryFn: async () => {
      const { data: docs, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const orgIds = [...new Set((docs || []).map(d => d.organization_id))];
      const uploaderIds = [...new Set((docs || []).map(d => d.uploaded_by))];

      const [orgsRes, profilesRes] = await Promise.all([
        orgIds.length > 0
          ? supabase.from('organizations').select('id, name').in('id', orgIds)
          : { data: [] },
        uploaderIds.length > 0
          ? supabase.from('profiles').select('id, full_name').in('id', uploaderIds)
          : { data: [] },
      ]);

      const orgMap = new Map((orgsRes.data || []).map(o => [o.id, o.name]));
      const profileMap = new Map((profilesRes.data || []).map(p => [p.id, p.full_name]));

      return (docs || []).map(doc => ({
        ...doc,
        org_name: orgMap.get(doc.organization_id) || 'Unknown',
        uploader_name: profileMap.get(doc.uploaded_by) || 'Unknown',
      })) as KnowledgeDocument[];
    },
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await supabase.from('knowledge_chunks').delete().eq('document_id', deleteId);
      const { error } = await supabase.from('knowledge_documents').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Document deleted');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const filtered = documents.filter(doc =>
    doc.title.toLowerCase().includes(search.toLowerCase()) ||
    doc.org_name?.toLowerCase().includes(search.toLowerCase()) ||
    doc.uploader_name?.toLowerCase().includes(search.toLowerCase()) ||
    doc.source_type.toLowerCase().includes(search.toLowerCase())
  );

  const contentPreview = (text: string | null) => {
    if (!text) return '—';
    return text.length > 80 ? text.slice(0, 80) + '…' : text;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" /> Knowledge Library ({documents.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="pl-9 h-9"
              />
            </div>
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setUploadOpen(true)}>
              <Plus className="h-4 w-4" /> Add Source
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {search ? 'No documents match your search' : 'No knowledge documents yet'}
              </p>
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4" /> Add your first source
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Chunks</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="font-medium text-sm truncate">{doc.title}</p>
                          {doc.content_text && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {contentPreview(doc.content_text)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {sourceTypeIcon(doc.source_type)}
                          <span className="text-xs capitalize">{doc.source_type}</span>
                        </div>
                        {doc.source_url && (
                          <a
                            href={doc.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5"
                          >
                            <ExternalLink className="h-2.5 w-2.5" /> Link
                          </a>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(doc.status)} className="text-[10px]">
                          {doc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">
                        {doc.total_chunks ?? 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.org_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.uploader_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        userId={user?.id}
        orgId={currentOrg?.id}
        onComplete={() => { refetch(); setUploadOpen(false); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the document and all its chunks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ──────────────────────────────────────────────
// Upload Dialog Component
// ──────────────────────────────────────────────

function UploadDialog({
  open,
  onOpenChange,
  userId,
  orgId,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  orgId?: string;
  onComplete: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<string>('pdf');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');

  // PDF upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // URL state
  const [urls, setUrls] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfs.length !== files.length) {
      toast.error('Only PDF files are supported');
    }
    setSelectedFiles(prev => [...prev, ...pdfs].slice(0, 20)); // Max 20
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadPDFs = async () => {
    if (!userId || !orgId || selectedFiles.length === 0) return;
    setUploading(true);
    setProgress(0);

    const total = selectedFiles.length;
    let completed = 0;

    for (const file of selectedFiles) {
      try {
        setProgressLabel(`Uploading ${file.name}...`);
        const filePath = `${orgId}/${Date.now()}-${file.name}`;

        // Upload to storage
        const { error: uploadErr } = await supabase.storage
          .from('knowledge-files')
          .upload(filePath, file, { contentType: 'application/pdf' });

        if (uploadErr) {
          toast.error(`Failed to upload ${file.name}: ${uploadErr.message}`);
          continue;
        }

        // Create document record
        const { data: docData, error: docErr } = await supabase
          .from('knowledge_documents')
          .insert({
            title: file.name.replace('.pdf', ''),
            source_type: 'pdf',
            file_path: filePath,
            organization_id: orgId,
            uploaded_by: userId,
            status: 'processing',
            metadata: { file_size: file.size, file_name: file.name },
          })
          .select('id')
          .single();

        if (docErr || !docData) {
          toast.error(`Failed to create record for ${file.name}`);
          continue;
        }

        // Trigger ingestion
        setProgressLabel(`Processing ${file.name}...`);
        const { error: fnErr } = await supabase.functions.invoke('ingest-knowledge', {
          body: {
            document_id: docData.id,
            source_type: 'pdf',
            file_path: filePath,
          },
        });

        if (fnErr) {
          toast.error(`Failed to process ${file.name}: ${fnErr.message}`);
        }

        completed++;
        setProgress(Math.round((completed / total) * 100));
      } catch (err: any) {
        toast.error(`Error with ${file.name}: ${err.message}`);
      }
    }

    toast.success(`Processed ${completed}/${total} files`);
    setSelectedFiles([]);
    setUploading(false);
    setProgress(0);
    setProgressLabel('');
    onComplete();
  };

  const handleIngestURLs = async () => {
    if (!userId || !orgId) return;
    const urlList = urls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://')));

    if (urlList.length === 0) {
      toast.error('Please enter at least one valid URL (starting with http:// or https://)');
      return;
    }

    setUploading(true);
    setProgress(0);
    const total = urlList.length;
    let completed = 0;

    for (const url of urlList) {
      try {
        setProgressLabel(`Scraping ${new URL(url).hostname}...`);

        // Create document record
        const { data: docData, error: docErr } = await supabase
          .from('knowledge_documents')
          .insert({
            title: new URL(url).hostname + new URL(url).pathname.slice(0, 60),
            source_type: 'url',
            source_url: url,
            organization_id: orgId,
            uploaded_by: userId,
            status: 'processing',
            metadata: { original_url: url },
          })
          .select('id')
          .single();

        if (docErr || !docData) {
          toast.error(`Failed to create record for ${url}`);
          continue;
        }

        // Trigger ingestion
        const { error: fnErr } = await supabase.functions.invoke('ingest-knowledge', {
          body: {
            document_id: docData.id,
            source_type: 'url',
            source_url: url,
          },
        });

        if (fnErr) {
          toast.error(`Failed to process ${url}: ${fnErr.message}`);
        }

        completed++;
        setProgress(Math.round((completed / total) * 100));
      } catch (err: any) {
        toast.error(`Error with URL: ${err.message}`);
      }
    }

    toast.success(`Processed ${completed}/${total} URLs`);
    setUrls('');
    setUploading(false);
    setProgress(0);
    setProgressLabel('');
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Add Knowledge Source
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="pdf" className="flex-1 gap-1.5">
              <FileUp className="h-3.5 w-3.5" /> Upload PDFs
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 gap-1.5">
              <Link className="h-3.5 w-3.5" /> Web URLs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pdf" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm mb-2 block">Select PDF files (max 20, up to 20MB each)</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to select PDFs or drag & drop
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Training manuals, research papers, methodology guides
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeFile(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={handleUploadPDFs}
              disabled={uploading || selectedFiles.length === 0}
              className="w-full gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Processing...' : `Upload & Process ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}`}
            </Button>
          </TabsContent>

          <TabsContent value="url" className="space-y-4 mt-4">
            <div>
              <Label className="text-sm mb-2 block">Enter URLs (one per line)</Label>
              <Textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={"https://pubmed.ncbi.nlm.nih.gov/example\nhttps://journals.example.com/sports-science/article\nhttps://example.com/training-methodology"}
                rows={5}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Research papers, articles, and publicly accessible training resources.
                The AI will extract and clean the content automatically.
              </p>
            </div>

            <Button
              onClick={handleIngestURLs}
              disabled={uploading || !urls.trim()}
              className="w-full gap-2"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              {uploading ? 'Scraping...' : 'Scrape & Ingest URLs'}
            </Button>
          </TabsContent>
        </Tabs>

        {uploading && (
          <div className="space-y-2 pt-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">{progressLabel || `${progress}% complete`}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
