import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Search, FileText, Globe, Upload, Trash2, ExternalLink } from 'lucide-react';
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
    case 'file': return <Upload className="h-3.5 w-3.5" />;
    default: return <FileText className="h-3.5 w-3.5" />;
  }
};

const statusVariant = (status: string) => {
  switch (status) {
    case 'processed': return 'default' as const;
    case 'pending': return 'secondary' as const;
    case 'error': return 'destructive' as const;
    default: return 'outline' as const;
  }
};

export default function KnowledgeLibraryTab() {
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: documents = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-knowledge-documents'],
    queryFn: async () => {
      // Fetch all documents (master admin has access via RLS through org membership)
      const { data: docs, error } = await supabase
        .from('knowledge_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with org names and uploader names
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
      // Delete chunks first, then document
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
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="pl-9 h-9"
            />
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
                    <TableHead>Updated</TableHead>
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
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}
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
