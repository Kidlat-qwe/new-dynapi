import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function UserSystems() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">My Systems</h2>
        <p className="text-muted-foreground">Systems you have permission to access.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Assigned Systems</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your assigned systems will appear here once user_permission is configured.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
