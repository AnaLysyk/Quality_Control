import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SMTP_HOST,
        port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
        secure: false, // true para 465, false para outras portas
        auth: {
          user: process.env.EMAIL_SMTP_USER,
          pass: process.env.EMAIL_SMTP_PASS,
        },
      });
    }
    return this.transporter;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Evita chamadas de rede em ambientes de dev/teste.
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        console.log('[DEV MODE] Email would be sent:');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`HTML: ${options.html.substring(0, 200)}...`);
        return true;
      }

      const transporter = this.getTransporter();

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@quality-control.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Email enviado com sucesso:', result.messageId);
      return true;
    } catch (error) {
      console.error('Falha ao enviar email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/login/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Redefinir Senha - Quality Control</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px 20px; background: #f8f9fa; }
            .button { display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Quality Control</h1>
              <p>Redefinicao de senha</p>
            </div>
            <div class="content">
              <h2>Ola!</h2>
              <p>Recebemos uma solicitacao para redefinir sua senha. Clique no botao abaixo para criar uma nova senha:</p>

              <a href="${resetUrl}" class="button">Redefinir Senha</a>

              <p><strong>Link direto:</strong> ${resetUrl}</p>

              <p><em>Este link e valido por 15 minutos.</em></p>

              <p>Se voce nao solicitou esta redefinicao, ignore este email. Sua senha permanecera a mesma.</p>
            </div>
            <div class="footer">
              <p>Este e um email automatico. Por favor, nao responda.</p>
              <p>&copy; 2026 Quality Control. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
      Quality Control - Redefinicao de senha

      Ola!

      Recebemos uma solicitacao para redefinir sua senha.

      Clique no link abaixo para criar uma nova senha:
      ${resetUrl}

      Este link e valido por 15 minutos.

      Se voce nao solicitou esta redefinicao, ignore este email.

      Atenciosamente,
      Equipe Quality Control
    `;

    return this.sendEmail({
      to: email,
      subject: 'Redefinir Senha - Quality Control',
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
