import nodemailer from 'nodemailer'

export function createMailer(config) {
  if (!config.host || !config.from) return null

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.password } : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
  })

  return {
    async sendPasswordReset(email, token, baseUrl) {
      const resetUrl = new URL('/reset-password', baseUrl)
      resetUrl.searchParams.set('token', token)
      await transport.sendMail({
        from: config.from,
        to: email,
        subject: 'Reset your Bwiza Youth Bridge password',
        text: `Use this link to reset your password. It expires in 30 minutes: ${resetUrl.toString()}`,
      })
    },
  }
}
