import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, FileUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function FirstPlanCTA() {
  const navigate = useNavigate();

  return (
    <Card className="glass border-primary/20 overflow-hidden">
      <div className="h-1 gradient-hyrox" />
      <CardContent className="p-5 text-center space-y-3">
        <div className="h-12 w-12 rounded-2xl gradient-hyrox flex items-center justify-center mx-auto">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <p className="font-display font-bold">Get Your First Training Plan</p>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a personalized AI plan based on your profile and goal race, or import one from your coach.
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 gradient-hyrox" onClick={() => navigate('/plans')}>
            <Sparkles className="h-4 w-4 mr-2" /> Generate Plan
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate('/plans')}>
            <FileUp className="h-4 w-4 mr-2" /> Import
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
