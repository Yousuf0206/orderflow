"""Transactional email sending (FR-014: overdue / due-soon alerts; also used
for password reset and team invites).

For MVP this is a thin, swappable stub: if SMTP settings are configured it
sends via smtplib, otherwise it logs the email instead of failing (so local
development and tests don't require a real mail server). Swap the body of
`send_email` for a provider SDK (SES/Postmark/SendGrid) in production without
touching any caller.
"""

import logging
import smtplib
from email.message import EmailMessage

from src.core.config import settings

logger = logging.getLogger("orderflow.email")


def send_email(*, to: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        logger.info("EMAIL (no SMTP configured) to=%s subject=%s body=%s", to, subject, body)
        return

    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        if settings.smtp_user:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
