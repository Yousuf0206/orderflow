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
from typing import Literal

from src.core.config import settings

logger = logging.getLogger("orderflow.email")

# What actually happened to the message. Callers that tell a user "we sent it"
# must distinguish these three, because two of them mean nothing arrived.
EmailOutcome = Literal["sent", "not_configured", "failed"]


def send_email(*, to: str, subject: str, body: str) -> EmailOutcome:
    """Send a message, and report what happened rather than nothing.

    This used to return None on every path, including the unconfigured one
    below. Callers therefore could not tell a logged message from a delivered
    one, and the team-invite screen told owners an invitation had been emailed
    when the link had only been written to a server log.

    A failure is returned, not raised: an invitation whose email failed is
    still a valid invitation, and turning it into a 500 would discard a usable
    pending membership and a usable link.
    """
    if not settings.smtp_host:
        logger.info("EMAIL (no SMTP configured) to=%s subject=%s body=%s", to, subject, body)
        return "not_configured"

    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            if settings.smtp_user:
                smtp.starttls()
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except OSError:
        # smtplib raises SMTPException and socket errors, both OSError
        # subclasses. Logged with the traceback so an operator can diagnose it;
        # the caller only needs to know it did not arrive.
        logger.exception("EMAIL failed to=%s subject=%s", to, subject)
        return "failed"
    return "sent"
