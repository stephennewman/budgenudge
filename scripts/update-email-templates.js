#!/usr/bin/env node

/**
 * Script to update Supabase email templates with custom fonts
 * Updates all email templates to use Manrope font with Arial fallback
 */

const PROJECT_REF = 'oexkzqvoepdeywlyfsdj'; // Your krezzo project ID

// You'll need to get your access token from: https://supabase.com/dashboard/account/tokens
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('❌ Error: SUPABASE_ACCESS_TOKEN environment variable is required');
  console.log('Get your access token from: https://supabase.com/dashboard/account/tokens');
  console.log('Then run: SUPABASE_ACCESS_TOKEN=your_token node scripts/update-email-templates.js');
  process.exit(1);
}

// Custom CSS styles with Manrope font (imported from Google Fonts)
const fontStyles = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');
  
  body {
    font-family: 'Manrope', Arial, sans-serif !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Manrope', Arial, sans-serif !important;
    font-weight: 600;
  }
  
  p, span, div, a {
    font-family: 'Manrope', Arial, sans-serif !important;
  }
  
  .email-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 40px 20px;
    background-color: #ffffff;
  }
  
  .email-header {
    text-align: center;
    margin-bottom: 40px;
  }
  
  .email-button {
    display: inline-block;
    padding: 14px 28px;
    background-color: #3b82f6;
    color: white !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
    font-family: 'Manrope', Arial, sans-serif !important;
    transition: background-color 0.2s ease;
  }
  
  .email-button:hover {
    background-color: #2563eb;
  }
  
  .email-footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 14px;
    text-align: center;
  }
</style>
`;

// Updated email templates with Manrope font and modern styling
const emailTemplates = {
  // Confirmation email (signup verification)
  mailer_templates_confirmation_content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${fontStyles}
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Welcome to Krezzo!</h1>
    </div>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Thank you for signing up! Please confirm your email address to get started with your financial insights.
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="email-button">
        Confirm your email
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
      If you didn't create an account with Krezzo, you can safely ignore this email.
    </p>
    
    <div class="email-footer">
      <p>
        © 2025 Krezzo. All rights reserved.<br>
        Need help? Contact us at <a href="mailto:support@krezzo.com" style="color: #3b82f6;">support@krezzo.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `,

  // Magic link email
  mailer_templates_magic_link_content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${fontStyles}
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Your Krezzo Login Link</h1>
    </div>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Click the button below to securely log in to your Krezzo account:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="email-button">
        Log in to Krezzo
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
      This link will expire in 1 hour. If you didn't request this login link, you can safely ignore this email.
    </p>
    
    <div class="email-footer">
      <p>
        © 2025 Krezzo. All rights reserved.<br>
        Need help? Contact us at <a href="mailto:support@krezzo.com" style="color: #3b82f6;">support@krezzo.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `,

  // Password recovery email
  mailer_templates_recovery_content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${fontStyles}
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Reset Your Password</h1>
    </div>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      We received a request to reset your Krezzo account password. Click the button below to create a new password:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="email-button">
        Reset Password
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
      This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
    </p>
    
    <div class="email-footer">
      <p>
        © 2025 Krezzo. All rights reserved.<br>
        Need help? Contact us at <a href="mailto:support@krezzo.com" style="color: #3b82f6;">support@krezzo.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `,

  // Invite email
  mailer_templates_invite_content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${fontStyles}
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 style="color: #1f2937; margin: 0; font-size: 28px;">You're Invited to Krezzo!</h1>
    </div>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      You've been invited to join Krezzo, the smart financial insights platform. Get started by accepting this invitation:
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="email-button">
        Accept Invitation
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
      This invitation link will expire in 24 hours. If you weren't expecting this invitation, you can safely ignore this email.
    </p>
    
    <div class="email-footer">
      <p>
        © 2025 Krezzo. All rights reserved.<br>
        Need help? Contact us at <a href="mailto:support@krezzo.com" style="color: #3b82f6;">support@krezzo.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `,

  // Email change confirmation
  mailer_templates_email_change_content: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${fontStyles}
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1 style="color: #1f2937; margin: 0; font-size: 28px;">Confirm Email Change</h1>
    </div>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Please confirm that you want to change your email address on your Krezzo account to: <strong>{{ .NewEmail }}</strong>
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="email-button">
        Confirm Email Change
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
      If you didn't request this email change, please ignore this email and contact support immediately.
    </p>
    
    <div class="email-footer">
      <p>
        © 2025 Krezzo. All rights reserved.<br>
        Need help? Contact us at <a href="mailto:support@krezzo.com" style="color: #3b82f6;">support@krezzo.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `
};

async function updateEmailTemplates() {
  console.log('🚀 Starting email template update for Krezzo project...\n');

  try {
    // First, get current templates to see what we're working with
    console.log('📋 Fetching current email templates...');
    const getCurrentResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!getCurrentResponse.ok) {
      throw new Error(`Failed to get current templates: ${getCurrentResponse.status} ${getCurrentResponse.statusText}`);
    }

    const currentConfig = await getCurrentResponse.json();
    
    // Log current mailer templates
    const currentTemplates = Object.keys(currentConfig).filter(key => key.startsWith('mailer_templates'));
    console.log(`📧 Found ${currentTemplates.length} existing email templates:`);
    currentTemplates.forEach(template => {
      console.log(`   • ${template}`);
    });

    // Update the templates
    console.log('\n🎨 Updating email templates with Manrope font...');
    const updateResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailTemplates)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update templates: ${updateResponse.status} ${updateResponse.statusText}\n${errorText}`);
    }

    console.log('✅ Email templates updated successfully!');
    console.log('\n📝 Updated templates:');
    Object.keys(emailTemplates).forEach(template => {
      console.log(`   • ${template} ✓`);
    });

    console.log('\n🎉 All done! Your Supabase verification emails now use Manrope font with Arial fallback.');
    console.log('\n💡 Next steps:');
    console.log('   1. Test the emails by signing up a new user');
    console.log('   2. Check your email to see the new styling');
    console.log('   3. You can further customize the templates in the Supabase Dashboard');
    
  } catch (error) {
    console.error('❌ Error updating email templates:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Verify your SUPABASE_ACCESS_TOKEN is correct');
    console.log('   2. Make sure you have the right permissions on the project');
    console.log('   3. Check that the project ID is correct');
    process.exit(1);
  }
}

// Run the update
updateEmailTemplates();