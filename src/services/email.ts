/**
 * メール送信サービス（SendGrid）
 * 
 * 機能:
 * - スタッフ招待メール
 * - 顧客招待メール
 * - パスワードリセットメール
 */

import type { Env } from '../types';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * SendGrid経由でメール送信
 */
export async function sendEmail(
  env: Env,
  params: SendEmailParams
): Promise<EmailResult> {
  const apiKey = env.SENDGRID_API_KEY;
  const fromEmail = env.SENDGRID_FROM_EMAIL || 'noreply@hojyokin.pages.dev';
  
  if (!apiKey) {
    console.warn('SendGrid API key not configured, skipping email send');
    return { success: false, error: 'Email service not configured' };
  }
  
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.to }] }],
        from: { email: fromEmail, name: 'ホジョラク' },
        subject: params.subject,
        content: [
          { type: 'text/plain', value: params.text || params.html.replace(/<[^>]*>/g, '') },
          { type: 'text/html', value: params.html },
        ],
      }),
    });
    
    if (response.ok || response.status === 202) {
      const messageId = response.headers.get('X-Message-Id') || undefined;
      return { success: true, messageId };
    } else {
      const errorText = await response.text();
      console.error('SendGrid error:', response.status, errorText);
      return { success: false, error: `SendGrid error: ${response.status}` };
    }
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * スタッフ招待メールを送信
 */
export async function sendStaffInviteEmail(
  env: Env,
  params: {
    to: string;
    inviterName: string;
    agencyName: string;
    inviteUrl: string;
    role: string;
    expiresAt: string;
  }
): Promise<EmailResult> {
  const roleLabel = params.role === 'admin' ? '管理者' : 'スタッフ';
  const expiresDate = new Date(params.expiresAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #047857; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #047857; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .info-box { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #047857; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">🏢 ホジョラク</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">補助金マッチングプラットフォーム</p>
    </div>
    <div class="content">
      <h2 style="color: #047857; margin-top: 0;">事務所への招待</h2>
      
      <p>${params.inviterName} さんから <strong>「${params.agencyName}」</strong> への招待が届いています。</p>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>役割:</strong> ${roleLabel}</p>
        <p style="margin: 5px 0 0 0;"><strong>有効期限:</strong> ${expiresDate}</p>
      </div>
      
      <p>以下のボタンをクリックして招待を受諾してください：</p>
      
      <p style="text-align: center;">
        <a href="${params.inviteUrl}" class="button">招待を受諾する</a>
      </p>
      
      <p style="font-size: 14px; color: #6b7280;">
        ボタンがクリックできない場合は、以下のURLをブラウザに直接貼り付けてください：<br>
        <a href="${params.inviteUrl}" style="color: #047857; word-break: break-all;">${params.inviteUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>このメールは ${params.inviterName} さんがあなたを招待したために送信されました。</p>
      <p>心当たりのない場合は、このメールを無視してください。</p>
      <p>&copy; ホジョラク</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return sendEmail(env, {
    to: params.to,
    subject: `【ホジョラク】${params.inviterName}さんから「${params.agencyName}」への招待`,
    html,
  });
}

/**
 * 顧客招待メールを送信
 */
export async function sendClientInviteEmail(
  env: Env,
  params: {
    to: string;
    inviterName: string;
    agencyName: string;
    clientName: string;
    inviteUrl: string;
    expiresAt: string;
    message?: string;
  }
): Promise<EmailResult> {
  const expiresDate = new Date(params.expiresAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const messageSection = params.message ? `
      <div class="info-box">
        <p style="margin: 0; font-weight: bold;">メッセージ:</p>
        <p style="margin: 10px 0 0 0;">${params.message}</p>
      </div>
  ` : '';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #047857; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #047857; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .info-box { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #047857; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">🏢 ホジョラク</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">補助金マッチングプラットフォーム</p>
    </div>
    <div class="content">
      <h2 style="color: #047857; margin-top: 0;">${params.clientName} 様</h2>
      
      <p><strong>${params.agencyName}</strong> の ${params.inviterName} さんから、企業情報の入力依頼が届いています。</p>
      
      ${messageSection}
      
      <div class="info-box">
        <p style="margin: 0;">企業情報を入力いただくことで、御社に最適な補助金を自動でマッチングし、申請をサポートいたします。</p>
      </div>
      
      <p style="text-align: center;">
        <a href="${params.inviteUrl}" class="button">企業情報を入力する</a>
      </p>
      
      <p style="font-size: 14px; color: #6b7280;">
        有効期限: ${expiresDate}<br>
        ボタンがクリックできない場合は、以下のURLをブラウザに直接貼り付けてください：<br>
        <a href="${params.inviteUrl}" style="color: #047857; word-break: break-all;">${params.inviteUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>このメールは ${params.agencyName} からの依頼により送信されました。</p>
      <p>心当たりのない場合は、このメールを無視してください。</p>
      <p>&copy; ホジョラク</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return sendEmail(env, {
    to: params.to,
    subject: `【ホジョラク】${params.agencyName}から企業情報入力のご依頼`,
    html,
  });
}

/**
 * パスワードリセットメールを送信
 */
export async function sendPasswordResetEmail(
  env: Env,
  params: {
    to: string;
    userName: string;
    resetUrl: string;
    expiresAt: string;
  }
): Promise<EmailResult> {
  const expiresDate = new Date(params.expiresAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #047857; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; background: #047857; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .warning { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #f59e0b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">🔐 ホジョラク</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">パスワードリセット</p>
    </div>
    <div class="content">
      <h2 style="color: #047857; margin-top: 0;">${params.userName} 様</h2>
      
      <p>パスワードリセットのリクエストを受け付けました。</p>
      
      <p>以下のボタンをクリックして、新しいパスワードを設定してください：</p>
      
      <p style="text-align: center;">
        <a href="${params.resetUrl}" class="button">パスワードをリセットする</a>
      </p>
      
      <div class="warning">
        <p style="margin: 0;"><strong>⚠️ 注意:</strong></p>
        <p style="margin: 5px 0 0 0;">このリンクの有効期限は <strong>${expiresDate}</strong> までです。</p>
        <p style="margin: 5px 0 0 0;">このリクエストに心当たりがない場合は、このメールを無視してください。パスワードは変更されません。</p>
      </div>
      
      <p style="font-size: 14px; color: #6b7280;">
        ボタンがクリックできない場合は、以下のURLをブラウザに直接貼り付けてください：<br>
        <a href="${params.resetUrl}" style="color: #047857; word-break: break-all;">${params.resetUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>このメールはパスワードリセットリクエストにより自動送信されました。</p>
      <p>&copy; ホジョラク</p>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  return sendEmail(env, {
    to: params.to,
    subject: '【ホジョラク】パスワードリセットのご案内',
    html,
  });
}
