import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Shield, Building2, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import UserManagementTab from '@/components/admin/UserManagementTab';
import AdminActivityTab from '@/components/admin/AdminActivityTab';
import KnowledgeLibraryTab from '@/components/admin/KnowledgeLibraryTab';
import { useTranslation } from 'react-i18next';

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminPanel() {
  const { t } = useTranslation();
  const { currentRole, currentOrg } = useAuth();
  const isMasterAdmin = currentRole === 'master_admin';
  const isAdmin = currentRole === 'admin' || isMasterAdmin;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t('auth.accessDenied')}</p>
      </div>
    );
  }

  return (
    <div className="page-container py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">{t('admin.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {isMasterAdmin ? t('admin.masterDesc') : t('admin.adminDesc')}
          </p>
        </div>
      </motion.div>

      <Tabs defaultValue={isMasterAdmin ? "orgs" : "users"}>
        <TabsList>
          {isMasterAdmin && <TabsTrigger value="orgs">{t('admin.organizations')}</TabsTrigger>}
          <TabsTrigger value="users">{t('admin.userManagement')}</TabsTrigger>
          {isMasterAdmin && <TabsTrigger value="knowledge" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Knowledge</TabsTrigger>}
          <TabsTrigger value="activity">{t('admin.activityLogTab')}</TabsTrigger>
        </TabsList>
        {isMasterAdmin && (
          <TabsContent value="orgs">
            <OrganizationsTab />
          </TabsContent>
        )}
        <TabsContent value="users">
          <UserManagementTab isMasterAdmin={isMasterAdmin} currentOrgId={currentOrg?.id} />
        </TabsContent>
        <TabsContent value="activity">
          <AdminActivityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrganizationsTab() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formName, setFormName] = useState('');
  const [formLogo, setFormLogo] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchOrgs = async () => {
    const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
    if (!error) setOrgs((data as unknown as Organization[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrgs(); }, []);

  const openCreate = () => { setEditingOrg(null); setFormName(''); setFormLogo(''); setDialogOpen(true); };
  const openEdit = (org: Organization) => { setEditingOrg(org); setFormName(org.name); setFormLogo(org.logo_url ?? ''); setDialogOpen(true); };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    if (editingOrg) {
      const { error } = await supabase.from('organizations').update({ name: formName.trim(), logo_url: formLogo.trim() || null }).eq('id', editingOrg.id);
      error ? toast.error(error.message) : toast.success('Updated');
    } else {
      const { error } = await supabase.from('organizations').insert({ name: formName.trim(), logo_url: formLogo.trim() || null });
      error ? toast.error(error.message) : toast.success('Created');
    }
    setSaving(false); setDialogOpen(false); fetchOrgs();
  };

  const toggleActive = async (org: Organization) => {
    const { error } = await supabase.from('organizations').update({ is_active: !org.is_active } as any).eq('id', org.id);
    error ? toast.error(error.message) : toast.success(org.is_active ? 'Disabled' : 'Enabled');
    fetchOrgs();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" /> {t('admin.organizations')} ({orgs.length})
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t('admin.newOrg')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOrg ? t('admin.editOrg') : t('admin.createOrg')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t('admin.orgName')}</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Organization name" />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.logoUrl')}</Label>
                <Input value={formLogo} onChange={(e) => setFormLogo(e.target.value)} placeholder="https://..." />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? t('common.saving') : editingOrg ? t('common.save') : t('admin.create')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" /></div>
        ) : orgs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t('admin.noOrgsYet')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.orgName')}</TableHead>
                <TableHead>{t('admin.status')}</TableHead>
                <TableHead>{t('admin.created')}</TableHead>
                <TableHead className="text-right">{t('admin.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={org.is_active} onCheckedChange={() => toggleActive(org)} />
                      <span className={`text-xs ${org.is_active ? 'text-success' : 'text-destructive'}`}>
                        {org.is_active ? t('common.active') : t('common.disabled')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(org.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(org)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
