# Update Supabase Email Templates with Custom Fonts

This script updates all Supabase authentication email templates to use the **Manrope** font (with Arial fallback) instead of the default Times New Roman.

## What it updates

The script updates these email templates:
- ✉️ **Signup Confirmation** - Email verification for new users
- 🔗 **Magic Link** - Passwordless login emails  
- 🔐 **Password Recovery** - Password reset emails
- 👥 **User Invitation** - Invite emails for new users
- 📧 **Email Change** - Email address change confirmation

## Prerequisites

1. **Get a Supabase Access Token**:
   - Go to https://supabase.com/dashboard/account/tokens
   - Click "Generate new token"
   - Give it a name like "Email Template Update"
   - Copy the token

2. **Node.js** installed on your machine

## How to run

1. **Set your access token** as an environment variable:
   ```bash
   export SUPABASE_ACCESS_TOKEN="your_token_here"
   ```

2. **Run the script**:
   ```bash
   node scripts/update-email-templates.js
   ```

   Or in one command:
   ```bash
   SUPABASE_ACCESS_TOKEN="your_token_here" node scripts/update-email-templates.js
   ```

## What the script does

1. **Fetches current templates** from your Krezzo Supabase project
2. **Updates all email templates** with:
   - Manrope font imported from Google Fonts
   - Arial as fallback font
   - Modern, clean styling
   - Responsive design
   - Branded colors and layout
3. **Uploads the new templates** to Supabase

## Font stack used

```css
font-family: 'Manrope', Arial, sans-serif;
```

- **Primary**: Manrope (loaded from Google Fonts)
- **Fallback**: Arial
- **Final fallback**: sans-serif

## Testing

After running the script:

1. **Test signup flow**: Create a new account to receive the confirmation email
2. **Test magic link**: Use the "forgot password" or magic link login
3. **Check styling**: Verify the emails now use Manrope font

## Manual verification

You can also verify the changes in the Supabase Dashboard:
1. Go to Authentication → Email Templates
2. View each template to see the updated HTML/CSS

## Troubleshooting

**❌ "SUPABASE_ACCESS_TOKEN environment variable is required"**
- Make sure you've set the environment variable correctly
- Double-check the token from the dashboard

**❌ "Failed to update templates: 401"**
- Your access token might be invalid or expired
- Generate a new token from the dashboard

**❌ "Failed to update templates: 403"**
- You might not have permission to modify the project
- Make sure you're an owner/admin of the Supabase project

## Customization

To further customize the templates:
1. Edit the `emailTemplates` object in the script
2. Modify colors, fonts, or layout
3. Run the script again to apply changes

The templates use modern CSS with:
- Google Fonts integration
- Responsive design
- Clean typography
- Accessible colors
- Professional styling