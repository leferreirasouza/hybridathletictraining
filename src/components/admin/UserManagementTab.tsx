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

  const fetchMembers = async () => {
    setLoadingMembers(true);
    let query = supabase
      .from('user_roles')
      .select('id, user_id, role, organization_id, organizations(name)');

    if (currentOrgId) {
      query = query.eq('organization_id', currentOrgId);
    }

    const { data: rolesData } = await query.order('created_at', { ascending: false }).limit(200);

    if (rolesData && rolesData.length > 0) {
      const userIds = [...new Set(rolesData.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profileMap = new Map(profilesData?.map((p) => [p.id, p]) ?? []);
      const merged: MemberRow[] = rolesData.map((r) => ({
        ...(r as MemberRow),
        profiles: profileMap.get(r.user_id) ?? null,
      }));
      setMembers(merged);
    } else {
      setMembers([]);
    }

    setSelectedIds(new Set());
    setLoadingMembers(false);
  };

  const fetchAssignments = async () => {
    setLoadingAssignments(true);
    let query = supabase
      .from('coach_athlete_assignments')
      .select('id, coach_id, athlete_id, coach_type, organization_id, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (currentOrgId) {
      query = query.eq('organization_id', currentOrgId);
    }

    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setAssignments([]);
    } else {
      setAssignments((data || []) as AssignmentRow[]);
    }
    setLoadingAssignments(false);
  };

  useEffect(() => {
    if (isMasterAdmin) {
      supabase
        .from('organizations')
        .select('id, name')
        .eq('is_active', true)
        .then(({ data }) => setOrgs(data ?? []));
    }

    fetchMembers();
    fetchAssignments();
  }, [currentOrgId, isMasterAdmin]);

  const memberDirectory = useMemo(() => {
    const byUserId = new Map<string, { userId: string; fullName: string; role: AppRole }>();

    members.forEach((member) => {
      const existing = byUserId.get(member.user_id);
      const nextRole = member.role;
      const nextName = member.profiles?.full_name || member.user_id;

      if (!existing || rolePriority[nextRole] < rolePriority[existing.role]) {
        byUserId.set(member.user_id, { userId: member.user_id, fullName: nextName, role: nextRole });
      }
    });

    return [...byUserId.values()].sort((a, b) => {
      if (a.userId === user?.id) return -1;
      if (b.userId === user?.id) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [members, user?.id]);

  const coachOptions = memberDirectory.filter((member) =>
    member.role === 'coach' || member.role === 'admin' || member.role === 'master_admin' || member.userId === user?.id,
  );

  const athleteOptions = memberDirectory.filter((member) => member.role === 'athlete' || member.userId === user?.id);
  const athleteSelectionOptions = athleteOptions.length > 0 ? athleteOptions : memberDirectory;

  const memberNameByUserId = useMemo(
    () => new Map(memberDirectory.map((member) => [member.userId, member.fullName])),
    [memberDirectory],
  );

  useEffect(() => {
    if (!user) return;

    if (!assignmentCoachId || !coachOptions.some((option) => option.userId === assignmentCoachId)) {
      const selfCoach = coachOptions.find((option) => option.userId === user.id);
      setAssignmentCoachId(selfCoach?.userId || coachOptions[0]?.userId || '');
    }

    if (!assignmentAthleteId || !athleteSelectionOptions.some((option) => option.userId === assignmentAthleteId)) {
      const selfAthlete = athleteSelectionOptions.find((option) => option.userId === user.id);
      setAssignmentAthleteId(selfAthlete?.userId || athleteSelectionOptions[0]?.userId || '');
    }
  }, [user, coachOptions, athleteSelectionOptions, assignmentCoachId, assignmentAthleteId]);

  const handleCreateAssignment = async () => {
    const targetOrgId = currentOrgId || orgId;
    if (!targetOrgId) {
      toast.error('Select an organization first');
      return;
    }
    if (!assignmentCoachId || !assignmentAthleteId) {
      toast.error('Select both coach and athlete');
      return;
    }

    setAssignmentSaving(true);
    try {
      const existing = assignments.find(
        (assignment) =>
          assignment.organization_id === targetOrgId &&
          assignment.coach_id === assignmentCoachId &&
          assignment.athlete_id === assignmentAthleteId,
      );

      if (existing) {
        if (existing.coach_type === assignmentCoachType) {
          toast.message('This coach-athlete assignment already exists');
          setAssignmentSaving(false);
          return;
        }

        const { error } = await supabase
          .from('coach_athlete_assignments')
          .update({ coach_type: assignmentCoachType })
          .eq('id', existing.id);
        if (error) throw error;
        toast.success('Assignment updated');
      } else {
        const { error } = await supabase.from('coach_athlete_assignments').insert({
          organization_id: targetOrgId,
          coach_id: assignmentCoachId,
          athlete_id: assignmentAthleteId,
          coach_type: assignmentCoachType,
        });
        if (error) throw error;

        const coachName = memberNameByUserId.get(assignmentCoachId) || 'Coach';
        const athleteName = memberNameByUserId.get(assignmentAthleteId) || 'Athlete';
        toast.success(`${coachName} assigned to ${athleteName}`);
      }

      await fetchAssignments();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save assignment');
    }
    setAssignmentSaving(false);
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    const { error } = await supabase.from('coach_athlete_assignments').delete().eq('id', assignmentId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Assignment removed');
    fetchAssignments();
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!orgId) {
      toast.error('Select an organization');
      return;
    }

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
      await fetchMembers();
    } catch (e: any) {
      toast.error(e.message || 'Failed to invite user.');
    }
    setSaving(false);
  };

  const handleChangeRole = async (memberId: string, newRole: AppRole) => {
    const { error } = await supabase.from('user_roles').update({ role: newRole }).eq('id', memberId);
    error ? toast.error(error.message) : toast.success('Role updated');
    if (!error) {
      await fetchMembers();
      await fetchAssignments();
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from('user_roles').delete().eq('id', memberId);
    error ? toast.error(error.message) : toast.success('Member removed');
    if (!error) {
      await fetchMembers();
      await fetchAssignments();
    }
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
  const filteredMembers = members.filter((member) => {
    const name = (member.profiles?.full_name ?? '').toLowerCase();
    const userId = (member.user_id ?? '').toLowerCase();
    const orgName = (member.organizations?.name ?? '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || name.includes(q) || userId.includes(q) || orgName.includes(q);
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
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
    await fetchMembers();
    await fetchAssignments();
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
    await fetchMembers();
    await fetchAssignments();
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
              {filteredMembers.map((m) => (
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
                        {assignableRoles.map((r) => (
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

        <div className="pt-4 border-t border-border space-y-3">
          <div>
            <p className="text-sm font-semibold">Coach assignments</p>
            <p className="text-xs text-muted-foreground">Assign one coach to a specific athlete, including yourself for self-coaching.</p>
          </div>

          {!currentOrgId ? (
            <p className="text-xs text-muted-foreground">Pick an organization first to manage assignments.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Coach</Label>
                  <Select value={assignmentCoachId} onValueChange={setAssignmentCoachId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select coach" /></SelectTrigger>
                    <SelectContent>
                      {coachOptions.map((option) => (
                        <SelectItem key={option.userId} value={option.userId}>
                          {option.fullName}{option.userId === user?.id ? ' (You)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Athlete</Label>
                  <Select value={assignmentAthleteId} onValueChange={setAssignmentAthleteId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select athlete" /></SelectTrigger>
                    <SelectContent>
                      {athleteSelectionOptions.map((option) => (
                        <SelectItem key={option.userId} value={option.userId}>
                          {option.fullName}{option.userId === user?.id ? ' (You)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={assignmentCoachType} onValueChange={(value) => setAssignmentCoachType(value as CoachType)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button className="w-full" onClick={handleCreateAssignment} disabled={assignmentSaving || !coachOptions.length || !athleteSelectionOptions.length}>
                    {assignmentSaving ? 'Saving...' : 'Save assignment'}
                  </Button>
                </div>
              </div>

              {loadingAssignments ? (
                <div className="flex justify-center py-4"><div className="h-5 w-5 rounded-md gradient-hyrox animate-pulse" /></div>
              ) : assignments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No coach-athlete assignments yet.</p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((assignment) => {
                    const coachName = memberNameByUserId.get(assignment.coach_id) || `${assignment.coach_id.slice(0, 8)}...`;
                    const athleteName = memberNameByUserId.get(assignment.athlete_id) || `${assignment.athlete_id.slice(0, 8)}...`;
                    return (
                      <div key={assignment.id} className="flex items-center justify-between gap-3 p-2 rounded-md border border-border/60 bg-muted/20">
                        <div className="text-sm min-w-0">
                          <span className="font-medium">{coachName}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span className="font-medium">{athleteName}</span>
                          <span className="ml-2 text-xs text-muted-foreground capitalize">({assignment.coach_type})</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemoveAssignment(assignment.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
