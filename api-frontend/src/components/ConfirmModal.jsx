import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export function ConfirmModal({
  open,
  title = 'Confirm action',
  message = 'Are you sure you want to continue?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  destructive = true,
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} aria-hidden />
      <Card className="relative z-10 mx-4 w-full max-w-xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-sm text-muted-foreground">{message}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              {cancelText}
            </Button>
            <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={loading}>
              {loading ? 'Please wait...' : confirmText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}
