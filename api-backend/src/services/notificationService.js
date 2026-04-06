/**
 * Notification Service
 * Sends health alerts to n8n webhook in the format expected by Mattermost (Beeli Bot) and email.
 */

import logger from '../utils/logger.js';

const MATTERMOST_CHANNEL = '#alerts';
const MATTERMOST_USERNAME = 'Beeli Bot';
const MATTERMOST_ICON_URL = 'https://cdn-icons-png.flaticon.com/512/2920/2920277.png';
const WEBHOOK_TIMEOUT_MS = 10000;

/**
 * Build payload for n8n (Mattermost + email). Matches format expected by Beeli Bot / Spacemail.
 * @param {Object} alertData - { system_id, system_name, status, latencyMs, message, criticality, test? }
 * @param {string} primaryEmail - Primary email (comma-separated string allowed; first is used as primary)
 */
function buildWebhookPayload(alertData, primaryEmail) {
  const systemName = alertData.system_name || 'Unknown System';
  const databaseName = String(alertData.system_id ?? '');
  const currentStatus = alertData.status || 'unknown';
  const responseTime = alertData.latencyMs ?? alertData.response_time ?? 'N/A';
  const criticality = alertData.criticality || alertData.severity || 'medium';

  const primaryEmailStr = primaryEmail && String(primaryEmail).trim() ? String(primaryEmail).trim() : '';
  const alertEmails = primaryEmailStr
    ? primaryEmailStr.split(',').map((e) => e.trim()).filter(Boolean)
    : [];
  const primary = alertEmails[0] || primaryEmailStr || 'admin@example.com';

  const isDown = currentStatus === 'down';
  const isDegraded = currentStatus === 'degraded';
  const prefix = isDown ? '🚨 CRITICAL:' : isDegraded ? '⚠️ WARNING:' : '🔔 ALERT:';
  const statusText = isDown ? 'is DOWN!' : isDegraded ? 'Performance Degraded!' : 'requires attention!';
  const suffix = isDown ? ' - Immediate attention required' : isDegraded ? ' - Monitor closely' : ' - Investigate issue';

  const msg = `${prefix} ${systemName} Database ${statusText} Response time: ${responseTime}ms${suffix}`;
  const mattermostText = `${prefix} ${systemName} Database ${statusText} Response time: ${responseTime}ms${suffix}\n**Recipient:** ${primary}`;

  return {
    user_email: primary,
    msg,

    mattermost_channel: MATTERMOST_CHANNEL,
    mattermost_username: MATTERMOST_USERNAME,
    mattermost_icon_url: MATTERMOST_ICON_URL,
    mattermost_text: mattermostText,

    source: alertData.test ? 'health-monitoring-test' : 'health-monitoring-automatic',
    timestamp: new Date().toISOString(),
    alert_type: currentStatus,
    system_name: systemName,
    database_name: databaseName,
    system_id: alertData.system_id,
    current_status: currentStatus,
    response_time: responseTime,
    criticality,
    severity: criticality,

    notify_channels: ['email', 'mattermost'],
    priority: isDown ? 'high' : isDegraded ? 'medium' : 'low',

    bot_name: MATTERMOST_USERNAME,
    bot_type: 'mattermost',

    alert_emails: alertEmails.length ? alertEmails : [primary],
    primary_email: primary,
    primary_alert_emails: primaryEmailStr || null,

    ...(alertData.message && { message: alertData.message }),
    ...(alertData.test && { test: true }),
  };
}

/**
 * Send webhook notification to n8n (Mattermost + email flow).
 * @param {string} webhookUrl - Webhook URL
 * @param {Object} alertData - Alert data (system_id, system_name, status, latencyMs, message, criticality, test?)
 * @param {string} primaryAlertEmails - Comma-separated primary alert emails
 * @returns {Promise<boolean>}
 */
export async function sendWebhookNotification(webhookUrl, alertData, primaryAlertEmails) {
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.trim()) {
    logger.warn('[Notification Service] No webhook URL provided');
    return false;
  }
  try {
    const payload = buildWebhookPayload(alertData, primaryAlertEmails);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      logger.error(`[Notification Service] Webhook failed: ${response.status} ${response.statusText}`);
      return false;
    }
    logger.info(`[Notification Service] Webhook sent successfully to ${webhookUrl}`);
    return true;
  } catch (error) {
    logger.error('[Notification Service] Webhook failed:', error.message);
    return false;
  }
}

/**
 * Test webhook connectivity with a test payload (same format as real alerts).
 * @param {string} webhookUrl - Webhook URL to test
 * @param {Object} options - { system_id?, system_name?, primary_alert_emails? }
 * @returns {Promise<{ success: boolean, status?: number, statusText?: string, message: string, error?: string }>}
 */
export async function testWebhook(webhookUrl, options = {}) {
  const systemId = options.system_id ?? 'test-system';
  const systemName = options.system_name ?? 'Test System';
  const primaryAlertEmails = options.primary_alert_emails ?? '';

  const testPayload = buildWebhookPayload(
    {
      system_id: systemId,
      system_name: systemName,
      status: 'degraded',
      latencyMs: 0,
      message: 'This is a test notification from Health Monitoring.',
      criticality: 'low',
      test: true,
    },
    primaryAlertEmails
  );

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Webhook test successful' : `Webhook test failed: ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: `Webhook test failed: ${error.message}`,
    };
  }
}

export default {
  sendWebhookNotification,
  testWebhook,
  buildWebhookPayload,
};
