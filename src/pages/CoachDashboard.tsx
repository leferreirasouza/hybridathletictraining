import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, AlertTriangle, CheckCircle, TrendingUp, ChevronRight, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const mockAthletes = [
  { id: '1', name: 'Sarah Mitchell', compliance: 92, sessions: '5/6', flag: false, lastActive: '2h ago' },
  { id: '2', name: 'James Carter', compliance: 67, sessions: '3/5', flag: true, lastActive: '1d ago' },
  { id: '3', name: 'Emma Wilson', compliance: 100, sessions: '6/6', flag: false, lastActive: '30m ago' },
  { id: '4', name: 'Lucas Brown', compliance: 45, sessions: '2/5', flag: false, lastActive: '3d ago' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export default function CoachDashboard() {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-5">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={item} className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold">Coach Dashboard</h1>
            <p className="text-sm text-muted-foreground">{mockAthletes.length} athletes</p>
          </div>
          <Button size="sm" className="gradient-hyrox">
            <Plus className="h-4 w-4 mr-1" /> Invite
          </Button>
        </motion.div>

        {/* Overview Cards */}
        <motion.div variants={item} className="grid grid-cols-3 gap-3">
          <Card className="glass">
            <CardContent className="p-3 text-center">
              <CheckCircle className="h-4 w-4 mx-auto text-success mb-1" />
              <p className="text-lg font-display font-bold">76%</p>
              <p className="text-[10px] text-muted-foreground">Avg Compliance</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-3 text-center">
              <AlertTriangle className="h-4 w-4 mx-auto text-warning mb-1" />
              <p className="text-lg font-display font-bold">1</p>
              <p className="text-[10px] text-muted-foreground">Pain Flags</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto text-accent mb-1" />
              <p className="text-lg font-display font-bold">16</p>
              <p className="text-[10px] text-muted-foreground">Sessions/Week</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Athletes List */}
        <motion.div variants={item}>
          <Card className="glass">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <Users className="h-4 w-4" /> Athletes
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {mockAthletes.map(athlete => (
                <button
                  key={athlete.id}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  onClick={() => {}}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-secondary">
                        {athlete.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{athlete.name}</span>
                        {athlete.flag && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{athlete.sessions} sessions · {athlete.lastActive}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-xs ${
                      athlete.compliance >= 80 ? 'bg-success/10 text-success' :
                      athlete.compliance >= 60 ? 'bg-warning/10 text-warning' :
                      'bg-destructive/10 text-destructive'
                    }`}>
                      {athlete.compliance}%
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Plan Builder CTA */}
        <motion.div variants={item}>
          <Card className="glass border-primary/20 overflow-hidden">
            <div className="h-1 gradient-hyrox" />
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-sm">Plan Builder</p>
                  <p className="text-xs text-muted-foreground">Create or import training plans</p>
                </div>
                <Button size="sm" className="gradient-hyrox" onClick={() => navigate('/plans')}>
                  Open <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
