import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function UserDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">User Dashboard</h2>
        <p className="text-muted-foreground">Your assigned systems and access.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>My Systems</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Systems you have permission to access (user_permission).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
