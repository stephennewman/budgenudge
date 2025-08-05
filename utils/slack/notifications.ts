/**
 * Slack Notifications Utility
 * Handles sending notifications to Slack channels via webhooks
 */

interface SlackUser {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  signupSource?: string;
  conversionSource?: string;
}

interface SlackNotificationPayload {
  text: string;
  blocks?: Array<{
    type: string;
    text?: {
      type: string;
      text: string;
    };
    fields?: Array<{
      type: string;
      text: string;
    }>;
    accessory?: {
      type: string;
      text: {
        type: string;
        text: string;
      };
      url: string;
    };
  }>;
}

/**
 * Send a notification to Slack about a new user signup
 */
export async function notifySlackNewUserSignup(user: SlackUser): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('⚠️ SLACK_WEBHOOK_URL not configured - skipping Slack notification');
    return false;
  }

  try {
    const userDisplayName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user.email?.split('@')[0] || 'New User';

    const signupTime = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Create rich notification with Block Kit
    const payload: SlackNotificationPayload = {
      text: `🎉 New Krezzo Signup: ${userDisplayName}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 New Krezzo User Signup!"
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Name:*\n${userDisplayName}`
            },
            {
              type: "mrkdwn", 
              text: `*Email:*\n${user.email || 'Not provided'}`
            },
            {
              type: "mrkdwn",
              text: `*Phone:*\n${user.phone || 'Not provided'}`
            },
            {
              type: "mrkdwn",
              text: `*Signup Time:*\n${signupTime} EST`
            },
            {
              type: "mrkdwn",
              text: `*User ID:*\n\`${user.id}\``
            },
            {
              type: "mrkdwn",
              text: `*Source:*\n${user.signupSource || 'Direct signup'}`
            }
          ]
        }
      ]
    };

    // Add conversion tracking if available
    if (user.conversionSource) {
      payload.blocks?.push({
        type: "section", 
        text: {
          type: "mrkdwn",
          text: `📈 *Conversion:* ${user.conversionSource}`
        }
      });
    }

    // Add dashboard link
    payload.blocks?.push({
      type: "section",
      text: {
        type: "mrkdwn", 
        text: "View user dashboard"
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Open Dashboard"
        },
        url: `https://get.krezzo.com/protected`
      }
    });

    console.log('📤 Sending Slack notification for new user:', user.id);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ Slack notification sent successfully');
      return true;
    } else {
      const errorText = await response.text();
      console.error('❌ Slack notification failed:', response.status, errorText);
      return false;
    }

  } catch (error) {
    console.error('❌ Slack notification error:', error);
    return false;
  }
}

/**
 * Send a simple text notification to Slack
 */
export async function notifySlackSimple(message: string): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('⚠️ SLACK_WEBHOOK_URL not configured - skipping Slack notification');
    return false;
  }

  try {
    const payload = { text: message };
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    return response.ok;
  } catch (error) {
    console.error('❌ Slack simple notification error:', error);
    return false;
  }
}