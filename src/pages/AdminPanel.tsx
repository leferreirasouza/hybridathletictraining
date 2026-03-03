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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Shield, Building2, UserPlus, Users, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminPanel() {
  const { currentRole, effectiveRole, currentOrg } = useAuth();
  const isMasterAdmin = currentRole === 'master_admin';
  const isAdmin = currentRole === 'admin' || isMasterAdmin;

  // Only master_admin or admin can access
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl gradient-hyrox flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            {isMasterAdmin ? 'Manage organizations & admins' : 'Manage your organization'}
          </p>
        </div>
      </motion.div>

      <Tabs defaultValue={isMasterAdmin ? "orgs" : "users"}>
        <TabsList>
          {isMasterAdmin && <TabsTrigger value="orgs">Organizations</TabsTrigger>}
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>
        {isMasterAdmin && (
          <TabsContent value="orgs">
            <OrganizationsTab />
          </TabsContent>
        )}
        <TabsContent value="users">
          <UserManagementTab isMasterAdmin={isMasterAdmin} currentOrgId={currentOrg?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Organizations Tab (master_admin only) ─── */
function OrganizationsTab() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formName, setFormName] = useState('');
  const [formLogo, setFormLogo] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchOrgs = async () => {
    const { data, error } = await supabase
      .from('organizations').select('*').order('created_at', { ascending: false });
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
      const { error } = await supabase.from('organizations')
        .update({ name: formName.trim(), logo_url: formLogo.trim() || null })
        .eq('id', editingOrg.id);
      error ? toast.error(error.message) : toast.success('Updated');
    } else {
      const { error } = await supabase.from('organizations')
        .insert({ name: formName.trim(), logo_url: formLogo.trim() || null });
      error ? toast.error(error.message) : toast.success('Created');
    }
    setSaving(false); setDialogOpen(false); fetchOrgs();
  };

  const toggleActive = async (org: Organization) => {
    const { error } = await supabase.from('organizations')
      .update({ is_active: !org.is_active } as any).eq('id', org.id);
    error ? toast.error(error.message) : toast.success(org.is_active ? 'Disabled' : 'Enabled');
    fetchOrgs();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" /> Organizations ({orgs.length})
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Org
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOrg ? 'Edit Organization' : 'Create Organization'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Organization name" />
              </div>
              <div className="space-y-2">
                <Label>Logo URL (optional)</Label>
                <Input value={formLogo} onChange={(e) => setFormLogo(e.target.value)} placeholder="https://..." />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? 'Saving...' : editingOrg ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" /></div>
        ) : orgs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No organizations yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                        {org.is_active ? 'Active' : 'Disabled'}
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

/* ─── User Management Tab ─── */
function UserManagementTab({ isMasterAdmin, currentOrgId }: { isMasterAdmin: boolean; currentOrgId?: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('coach');
  const [orgId, setOrgId] = useState(currentOrgId ?? '');
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Roles this user can assign
  const assignableRoles: AppRole[] = isMasterAdmin
    ? ['admin', 'coach', 'athlete']
    : ['coach', 'athlete'];

  useEffect(() => {
    if (isMasterAdmin) {
      supabase.from('organizations').select('id, name').eq('is_active', true)
        .then(({ data }) => setOrgs(data ?? []));
    }
    fetchMembers();
  }, [currentOrgId]);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    let query = supabase.from('user_roles')
      .select('id, user_id, role, organization_id, organizations(name)');
    if (!isMasterAdmin && currentOrgId) {
      query = query.eq('organization_id', currentOrgId);
    }
    const { data } = await query.order('created_at', { ascending: false }).limit(100);
    setMembers(data ?? []);
    setLoadingMembers(false);
  };

  const handleInvite = async () => {
    if (!email.trim()) { toast.error('Email is required'); return; }
    if (!orgId) { toast.error('Select an organization'); return; }
    setSaving(true);

    try {
      // Create user via edge function or just create the role entry
      // For now, we create the auth user via admin invite (edge function)
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: email.trim(), full_name: fullName.trim(), role, organization_id: orgId },
      });

      if (error) throw error;
      toast.success(`Invitation sent to ${email}`);
      setDialogOpen(false);
      setEmail('');
      setFullName('');
      fetchMembers();
    } catch (e: any) {
      // Fallback: just show error, user needs to sign up first
      toast.error(e.message || 'Failed to invite user. They may need to sign up first.');
    }
    setSaving(false);
  };

  const handleChangeRole = async (memberId: string, newRole: AppRole) => {
    const { error } = await supabase.from('user_roles')
      .update({ role: newRole })
      .eq('id', memberId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Role updated');
      fetchMembers();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('user_roles')
      .delete()
      .eq('id', memberId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Member removed');
      fetchMembers();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" /> Team Members
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" type="email" />
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={v => setRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assignableRoles.map(r => (
                      <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isMasterAdmin && (
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Select value={orgId} onValueChange={setOrgId}>
                    <SelectTrigger><SelectValue placeholder="Select org" /></SelectTrigger>
                    <SelectContent>
                      {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleInvite} disabled={saving} className="w-full">
                {saving ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loadingMembers ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" /></div>
        ) : members.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No members found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.user_id?.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <Select value={m.role} onValueChange={(v) => handleChangeRole(m.id, v as AppRole)}>
                      <SelectTrigger className="w-[130px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map(r => (
                          <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.organizations?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove member?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the user's role from this organization. They will lose access immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemoveMember(m.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
