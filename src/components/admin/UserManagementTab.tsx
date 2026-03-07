import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { UserPlus, Users, Trash2, ShieldCheck, Search, X } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Props {
  isMasterAdmin: boolean;
  currentOrgId?: string;
}

type CoachType = 'primary' | 'secondary';

type MemberRow = {
  id: string;
  user_id: string;
  role: AppRole;
  organization_id: string;
  organizations?: { name?: string } | null;
  profiles?: { id: string; full_name: string } | null;
};

type AssignmentRow = {
  id: string;
  coach_id: string;
  athlete_id: string;
  coach_type: CoachType;
  organization_id: string;
  created_at: string;
};

const rolePriority: Record<AppRole, number> = {
  master_admin: 0,
  admin: 1,
  coach: 2,
  athlete: 3,
};

export default function UserManagementTab({ isMasterAdmin, currentOrgId }: Props) {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('coach');
  const [orgId, setOrgId] = useState(currentOrgId ?? '');
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentCoachId, setAssignmentCoachId] = useState('');
  const [assignmentAthleteId, setAssignmentAthleteId] = useState('');
  const [assignmentCoachType, setAssignmentCoachType] = useState<CoachType>('primary');
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRoleDialogOpen, setBulkRoleDialogOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState<AppRole>('athlete');
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const assignableRoles: AppRole[] = isMasterAdmin
    ? ['master_admin', 'admin', 'coach', 'athlete']
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
    const { data: rolesData } = await query.order('created_at', { ascending: false }).limit(100);
    
    if (rolesData && rolesData.length > 0) {
      // Fetch profiles separately since there's no FK from user_roles to profiles
      const userIds = [...new Set(rolesData.map(r => r.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      
      const profileMap = new Map(profilesData?.map(p => [p.id, p]) ?? []);
      const merged = rolesData.map(r => ({
        ...r,
        profiles: profileMap.get(r.user_id) ?? null,
      }));
      setMembers(merged);
    } else {
      setMembers([]);
    }
    setSelectedIds(new Set());
    setLoadingMembers(false);
  };

  const handleInvite = async () => {
    if (!email.trim()) { toast.error('Email is required'); return; }
    if (!orgId) { toast.error('Select an organization'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email: email.trim(), full_name: fullName.trim(), role, organization_id: orgId },
      });
      if (error) throw error;
      toast.success(`Invitation sent to ${email}`);
      setDialogOpen(false);
      setEmail('');
      setFullName('');
      fetchMembers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to invite user.');
    }
    setSaving(false);
  };

  const handleChangeRole = async (memberId: string, newRole: AppRole) => {
    const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('id', memberId);
    error ? toast.error(error.message) : toast.success('Role updated');
    if (!error) fetchMembers();
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('id', memberId);
    error ? toast.error(error.message) : toast.success('Member removed');
    if (!error) fetchMembers();
  };

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const filtered = filteredMembers;
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(m => m.id)));
    }
  };

  // Filtering
  const filteredMembers = members.filter((m: any) => {
    const name = (m.profiles?.full_name ?? '').toLowerCase();
    const userId = (m.user_id ?? '').toLowerCase();
    const orgName = (m.organizations?.name ?? '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || name.includes(q) || userId.includes(q) || orgName.includes(q);
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleBulkChangeRole = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('user_roles').update({ role: bulkRole }).in('id', ids);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Updated ${ids.length} member(s) to ${bulkRole.replace('_', ' ')}`);
    }
    setBulkActionLoading(false);
    setBulkRoleDialogOpen(false);
    fetchMembers();
  };

  const handleBulkRemove = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('user_roles').delete().in('id', ids);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Removed ${ids.length} member(s)`);
    }
    setBulkActionLoading(false);
    fetchMembers();
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" /> Team Members
        </CardTitle>
        <div className="flex items-center gap-2">
          {hasSelection && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
              <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>

              {/* Bulk Change Role */}
              <Dialog open={bulkRoleDialogOpen} onOpenChange={setBulkRoleDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" /> Change Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Role for {selectedIds.size} Member(s)</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>New Role</Label>
                      <Select value={bulkRole} onValueChange={v => setBulkRole(v as AppRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map(r => (
                            <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleBulkChangeRole} disabled={bulkActionLoading} className="w-full">
                      {bulkActionLoading ? 'Updating...' : `Update ${selectedIds.size} Member(s)`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Bulk Remove */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {selectedIds.size} member(s)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove all selected users from their organizations. They will lose access immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkRemove} disabled={bulkActionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {bulkActionLoading ? 'Removing...' : 'Remove All'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, user ID, or org..."
              className="pl-9 h-9"
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearchQuery('')}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {assignableRoles.map(r => (
                <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loadingMembers ? (
          <div className="flex justify-center py-8"><div className="h-6 w-6 rounded-lg gradient-hyrox animate-pulse" /></div>
        ) : filteredMembers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {members.length === 0 ? 'No members found.' : 'No members match your filters.'}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.size === filteredMembers.length && filteredMembers.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((m: any) => (
                <TableRow key={m.id} data-state={selectedIds.has(m.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(m.id)}
                      onCheckedChange={() => toggleSelect(m.id)}
                      aria-label={`Select ${m.user_id}`}
                    />
                  </TableCell>
                  <TableCell className="text-sm">{m.profiles?.full_name || <span className="text-muted-foreground italic">—</span>}</TableCell>
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
