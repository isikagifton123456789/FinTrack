import nodemailer from 'nodemailer'
import { HttpError } from './errors.js'

const smtpHost = process.env.SMTP_HOST ?? 'smtp.gmail.com'
const smtpPort = Number(process.env.SMTP_PORT ?? 465)
const smtpUser = process.env.SMTP_USER
const smtpPass = process.env.SMTP_PASS
const appUrl = process.env.APP_URL
const fromName = process.env.EMAIL_FROM_NAME ?? 'FinTrack'

let transporter

export function assertMailerConfigured() {
  if (!smtpUser || !smtpPass || !appUrl || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Email delivery is not configured. Contact the administrator.')
  }
  try {
    const url = new URL(appUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid frontend URL protocol.')
  } catch {
    throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Email delivery is not configured. Contact the administrator.')
  }
}

export async function sendVerificationEmail(email, name, token) {
  const url = new URL('/verify-email', appUrl)
  url.searchParams.set('token', token)
  await sendMail({
    to: email,
    subject: 'Verify your FinTrack email',
    text: `Hello ${name},\n\nVerify your email address to activate your FinTrack account:\n${url}\n\nThis link expires in 24 hours.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Verify your email address to activate your FinTrack account.</p><p><a href="${escapeHtml(url.toString())}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
  })
}

export async function sendPasswordResetEmail(email, name, token) {
  const url = new URL('/reset-password', appUrl)
  url.searchParams.set('token', token)
  await sendMail({
    to: email,
    subject: 'Reset your FinTrack password',
    text: `Hello ${name},\n\nReset your FinTrack password using this link:\n${url}\n\nThis link expires in 30 minutes. If you did not request a reset, you can ignore this email.`,
    html: `<p>Hello ${escapeHtml(name)},</p><p>Reset your FinTrack password using the link below.</p><p><a href="${escapeHtml(url.toString())}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request a reset, you can ignore this email.</p>`,
  })
}

async function sendMail(message) {
  assertMailerConfigured()
  try {
    transporter ??= nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass.replace(/\s/g, '') },
    })
    await transporter.sendMail({
      from: { name: fromName, address: process.env.EMAIL_FROM_ADDRESS ?? smtpUser },
      ...message,
    })
  } catch (error) {
    console.error('FinTrack email delivery failed', error)
    throw new HttpError(503, 'EMAIL_DELIVERY_FAILED', 'We could not send the email right now. Please try again later.')
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}
