# 🔔 Slack Notifications Setup Guide

This guide will help you set up Slack notifications for new user signups in BudgeNudge.

## 📋 Overview

When a new user completes email verification and account setup, BudgeNudge will automatically send a rich notification to your Slack channel with:

- ✅ User details (name, email, phone)
- ✅ Signup timestamp
- ✅ User ID for reference
- ✅ Conversion source tracking
- ✅ Direct link to dashboard

## 🛠️ Setup Instructions

### Step 1: Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"** → **"From scratch"**
3. Name your app (e.g., "BudgeNudge Notifications")
4. Select your Slack workspace
5. Click **"Create App"**

### Step 2: Enable Incoming Webhooks

1. In your app settings, go to **"Incoming Webhooks"** (left sidebar)
2. Toggle **"Activate Incoming Webhooks"** to **ON**
3. Click **"Add New Webhook to Workspace"**
4. Select the channel where you want notifications (e.g., `#general`, `#signups`)
5. Click **"Allow"**

### Step 3: Copy Your Webhook URL

1. After authorization, you'll see your webhook URL
2. It will look like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`
3. **Copy this URL** - you'll need it for the environment variable

### Step 4: Configure Environment Variable

Add the webhook URL to your environment variables:

#### For Local Development (.env.local):
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
```

#### For Production (Vercel):
1. Go to your Vercel project dashboard
2. Click **"Settings"** → **"Environment Variables"**
3. Add new variable:
   - **Name**: `SLACK_WEBHOOK_URL`
   - **Value**: Your webhook URL
   - **Environment**: Production (and Preview if desired)
4. Click **"Save"**

### Step 5: Deploy Changes

After setting the environment variable:

1. **Local**: Restart your development server
2. **Production**: Redeploy your app (automatic if using git push)

## 🧪 Testing

### Test the Integration

1. **API Test**: Visit `/api/test-slack-notification` in your browser to check configuration
2. **Simple Test**: 
   ```bash
   curl -X POST https://your-domain.com/api/test-slack-notification \
     -H "Content-Type: application/json" \
     -d '{"testType": "simple"}'
   ```
3. **Signup Test**:
   ```bash
   curl -X POST https://your-domain.com/api/test-slack-notification \
     -H "Content-Type: application/json" \
     -d '{"testType": "signup"}'
   ```

### Test with Real Signup

Create a new test account to see the full notification in action.

## 📨 Notification Format

The notification includes:

```
🎉 New BudgeNudge User Signup!

Name: John Doe
Email: john@example.com  
Phone: +15551234567
Signup Time: Mon, Jan 6, 2025, 02:30 PM EST
User ID: 550e8400-e29b-41d4-a716-446655440000
Source: Direct signup

[Open Dashboard] → https://get.krezzo.com/protected
```

## ⚠️ Troubleshooting

### No Notifications Received

1. **Check Environment Variable**: Ensure `SLACK_WEBHOOK_URL` is set correctly
2. **Verify Webhook URL**: Make sure it starts with `https://hooks.slack.com/services/`
3. **Check Logs**: Look for "Slack notification" messages in your application logs
4. **Test Endpoint**: Use the test API to verify configuration

### Webhook URL Invalid

- Regenerate the webhook URL in your Slack app settings
- Make sure you copied the complete URL
- Verify the Slack app has permission to post to the channel

### App Not Receiving Events

- Check that your Slack app is properly installed to your workspace
- Verify the webhook is associated with the correct channel
- Try recreating the webhook if issues persist

## 🔒 Security Notes

- **Keep webhook URLs private** - they provide access to post messages to your Slack
- Don't commit webhook URLs to version control
- Regenerate webhook URLs if they're compromised
- Use environment variables for all deployments

## 📚 Additional Resources

- [Slack API Documentation](https://api.slack.com/)
- [Slack Block Kit Builder](https://api.slack.com/block-kit/building) (for customizing message format)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

✅ **Setup Complete**: New user signups will now trigger Slack notifications automatically!