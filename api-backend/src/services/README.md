# Services

## notificationService.js

Handles sending health alerts to the n8n webhook in the format expected by **Mattermost (Beeli Bot)** and **Spacemail/Spaceship**.

### Payload format (n8n)

- **Email**: `user_email`, `msg`, `primary_email`, `alert_emails`
- **Mattermost**: `mattermost_channel`, `mattermost_username`, `mattermost_icon_url`, `mattermost_text`
- **Common**: `source`, `timestamp`, `alert_type`, `system_name`, `response_time`, `criticality`, `notify_channels`, `priority`, `bot_name`, `bot_type`

### Usage

- **sendWebhookNotification(webhookUrl, alertData, primaryAlertEmails)**  
  Used by health check when a system is degraded/down. Sends the full Beeli Bot payload.

- **testWebhook(webhookUrl, options)**  
  Used by "Test webhook" in the admin UI. Sends a test payload in the same format; `options` may include `system_id`, `system_name`, `primary_alert_emails`.

### Webhook URL

Configured per system in **Monitoring configuration** (fixed n8n URL in the frontend). The service does not read the database; callers pass `webhookUrl` and `primary_alert_emails`.
