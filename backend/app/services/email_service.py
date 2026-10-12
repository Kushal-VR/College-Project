import secrets
import smtplib
import time
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Tuple, List, Any
from app.core.config import settings
from app.core.logging import logger

# In-memory OTP storage: email -> (otp_code, expires_at_timestamp, purpose)
_OTP_CACHE: Dict[str, Tuple[str, float, str]] = {}

def generate_otp(length: int = 6) -> str:
    """Generate a cryptographically secure numeric OTP."""
    digits = "0123456789"
    return "".join(secrets.choice(digits) for _ in range(length))

def store_otp(email: str, otp: str, purpose: str = "login") -> None:
    """Store OTP in memory with expiration timestamp."""
    expires_at = time.time() + (settings.OTP_EXPIRE_MINUTES * 60)
    _OTP_CACHE[email.lower()] = (otp, expires_at, purpose)
    logger.info(f"OTP generated for {email} (purpose: {purpose}, expires in {settings.OTP_EXPIRE_MINUTES}m)")

def verify_otp_code(email: str, otp: str, purpose: str = "login") -> bool:
    """Verify OTP code for given email and purpose, consuming it upon success."""
    normalized_email = email.lower()
    record = _OTP_CACHE.get(normalized_email)
    
    if not record:
        logger.warning(f"OTP verification failed: No active OTP found for {email}")
        return False
        
    stored_otp, expires_at, stored_purpose = record
    
    if time.time() > expires_at:
        logger.warning(f"OTP verification failed: OTP expired for {email}")
        _OTP_CACHE.pop(normalized_email, None)
        return False
        
    if stored_purpose != purpose and stored_purpose != "Login 2FA Verification":
        logger.warning(f"OTP verification failed: Purpose mismatch for {email}")
        return False
        
    if stored_otp != otp.strip():
        logger.warning(f"OTP verification failed: Incorrect OTP entered for {email}")
        return False
        
    # Consume OTP (single use)
    _OTP_CACHE.pop(normalized_email, None)
    logger.info(f"OTP verified successfully for {email}")
    return True

def _dispatch_raw_smtp(to_email: str, subject: str, html_content: str, text_content: str = ""):
    """Actual network dispatch via SMTP."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_content or "Attendance System Notification", "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12)
        server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        server.quit()
        logger.info(f"Successfully delivered email to {to_email} via SMTP. Subject: {subject}")
    except Exception as exc:
        logger.error(f"SMTP delivery failed to {to_email}: {exc}")

def _dispatch_smtp_email(to_email: str, otp: str, user_name: str, purpose: str):
    """SMTP OTP email dispatch."""
    subject = f"[{purpose}] Your Security OTP: {otp}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; color: #f1f5f9; margin: 0; padding: 20px; }}
            .container {{ max-width: 520px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; }}
            .header {{ text-align: center; margin-bottom: 24px; }}
            .brand {{ font-size: 20px; font-weight: bold; color: #3b82f6; letter-spacing: -0.5px; }}
            .sub-brand {{ font-size: 12px; color: #94a3b8; }}
            .otp-box {{ background: #1e293b; border: 1px solid #3b82f6; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }}
            .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #38bdf8; font-family: monospace; }}
            .footer {{ font-size: 11px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="brand">Smart CCTV Attendance Ledger</div>
                <div class="sub-brand">Multi-Factor Biometric & Anti-Spoofing System</div>
            </div>
            <p>Hello <strong>{user_name}</strong>,</p>
            <p>Your one-time security verification code (OTP) for <strong>{purpose}</strong> is:</p>
            
            <div class="otp-box">
                <div class="otp-code">{otp}</div>
            </div>
            
            <p style="font-size: 13px; color: #94a3b8;">
                This code is valid for <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>. Do NOT share this code with anyone.
            </p>
            
            <div class="footer">
                Automated security notification from Smart CCTV Attendance System.<br>
                If you did not initiate this request, please contact your administrator immediately.
            </div>
        </div>
    </body>
    </html>
    """
    _dispatch_raw_smtp(to_email, subject, html_content, f"Your OTP is: {otp}")

def send_otp_email(to_email: str, otp: str, user_name: str = "User", purpose: str = "Login Verification", async_send: bool = True) -> bool:
    """Store OTP in memory immediately and dispatch SMTP email in a background thread."""
    store_otp(to_email, otp, purpose=purpose)
    
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials missing; skipping live email dispatch (OTP cached).")
        return True

    if async_send:
        thread = threading.Thread(
            target=_dispatch_smtp_email,
            args=(to_email, otp, user_name, purpose),
            daemon=True
        )
        thread.start()
        return True
    else:
        _dispatch_smtp_email(to_email, otp, user_name, purpose)
        return True

def send_class_attendance_report(
    to_email: str,
    teacher_name: str,
    class_info: Dict[str, Any],
    stats: Dict[str, Any],
    student_roster: List[Dict[str, Any]],
    async_send: bool = True
) -> bool:
    """
    Generate and deliver a high-end HTML attendance report to the assigned teacher via SMTP.
    Includes: class metadata, attendance rate %, present/absent counts, and student in/out roster table.
    """
    subject = f"Official Attendance Ledger: {class_info.get('subject_code', '')} {class_info.get('subject_name', '')} ({class_info.get('date', '')})"

    # Generate HTML rows for student roster
    rows_html = ""
    for idx, s in enumerate(student_roster, 1):
        status = s.get("status", "ABSENT")
        status_color = "#10b981" if status == "PRESENT" else "#f59e0b" if status == "LEFT_EARLY" else "#ef4444"
        bg_status = "rgba(16, 185, 129, 0.1)" if status == "PRESENT" else "rgba(245, 158, 11, 0.1)" if status == "LEFT_EARLY" else "rgba(239, 68, 68, 0.1)"
        
        in_time_str = s.get("in_time") or "—"
        out_time_str = s.get("out_time") or "—"
        mins = s.get("total_minutes_present", 0.0)
        
        rows_html += f"""
        <tr style="border-bottom: 1px solid #1e293b;">
            <td style="padding: 10px 14px; font-size: 13px; color: #94a3b8;">{idx}</td>
            <td style="padding: 10px 14px; font-size: 13px; font-weight: 600; color: #f8fafc; font-family: monospace;">{s.get('roll_number', '')}</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #e2e8f0;">{s.get('student_name', '')}</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #94a3b8; font-family: monospace;">{in_time_str}</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #94a3b8; font-family: monospace;">{out_time_str}</td>
            <td style="padding: 10px 14px; font-size: 13px; color: #38bdf8; font-weight: 600;">{mins}m</td>
            <td style="padding: 10px 14px; font-size: 12px;">
                <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-weight: bold; background: {bg_status}; color: {status_color}; border: 1px solid {status_color};">
                    {status}
                </span>
            </td>
        </tr>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030712; color: #f3f4f6; margin: 0; padding: 24px; }}
            .container {{ max-width: 760px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }}
            .header {{ background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 32px 32px 24px; border-bottom: 1px solid #1e293b; }}
            .brand {{ font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8; font-weight: 700; margin-bottom: 6px; }}
            .title {{ font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 8px 0; }}
            .meta {{ font-size: 13px; color: #94a3b8; }}
            .stats-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 24px 32px; background: #0b1120; border-bottom: 1px solid #1e293b; }}
            .stat-card {{ background: #131d35; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; text-align: center; }}
            .stat-val {{ font-size: 24px; font-weight: 800; color: #38bdf8; }}
            .stat-lbl {{ font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-top: 4px; }}
            .roster-container {{ padding: 24px 32px; overflow-x: auto; }}
            table {{ width: 100%; border-collapse: collapse; text-align: left; }}
            th {{ padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; background: #0b1120; border-bottom: 1px solid #1e293b; }}
            .footer {{ background: #090d16; padding: 20px 32px; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="brand">SMART CCTV ATTENDANCE LEDGER</div>
                <div class="title">{class_info.get('subject_name')} ({class_info.get('subject_code')})</div>
                <div class="meta">
                    Instructor: <strong>{teacher_name}</strong> &bull; Classroom: <strong>{class_info.get('classroom')}</strong> &bull; Date: <strong>{class_info.get('date')}</strong> ({class_info.get('time_slot')})
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-val" style="color: #f8fafc;">{stats.get('total_enrolled', 0)}</div>
                    <div class="stat-lbl">Enrolled</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val" style="color: #10b981;">{stats.get('present_count', 0)}</div>
                    <div class="stat-lbl">Present</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val" style="color: #f59e0b;">{stats.get('left_early_count', 0)}</div>
                    <div class="stat-lbl">Left Early</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val" style="color: #38bdf8;">{stats.get('attendance_rate', 0)}%</div>
                    <div class="stat-lbl">Attendance Rate</div>
                </div>
            </div>

            <div class="roster-container">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Roll No</th>
                            <th>Student Name</th>
                            <th>In-Time</th>
                            <th>Out-Time</th>
                            <th>Duration</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows_html}
                    </tbody>
                </table>
            </div>

            <div class="footer">
                Automated official attendance ledger generated via Smart CCTV Vision Engine.<br>
                Classroom session verified with continuous presence validation.
            </div>
        </div>
    </body>
    </html>
    """

    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials missing; skipping live attendance email dispatch.")
        return True

    if async_send:
        thread = threading.Thread(
            target=_dispatch_raw_smtp,
            args=(to_email, subject, html_content, f"Class Attendance: {class_info.get('subject_name')}"),
            daemon=True
        )
        thread.start()
        return True
    else:
        _dispatch_raw_smtp(to_email, subject, html_content, f"Class Attendance: {class_info.get('subject_name')}")
        return True

def send_occluded_exit_security_alert(
    to_email: str,
    teacher_name: str,
    classroom: str,
    timestamp_str: str,
    suspected_student_name: str,
    photo_proof_base64: str,
    async_send: bool = True
) -> bool:
    """Send immediate security alert with photographic proof when a student exits with covered face."""
    subject = f"SECURITY ALERT: Covered Face Exit Detected in {classroom} at {timestamp_str}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #030712; color: #f3f4f6; margin: 0; padding: 24px; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #0f172a; border: 1px solid #ef4444; border-radius: 16px; overflow: hidden; }}
            .header {{ background: #7f1d1d; padding: 24px; color: #fee2e2; }}
            .alert-title {{ font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 4px; }}
            .body {{ padding: 24px; }}
            .img-box {{ background: #000; border: 1px solid #334155; border-radius: 8px; padding: 8px; text-align: center; margin: 16px 0; }}
            .img-box img {{ max-width: 100%; border-radius: 4px; }}
            .meta-box {{ background: #1e293b; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px; }}
            .footer {{ background: #090d16; padding: 16px 24px; font-size: 11px; color: #64748b; text-align: center; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">SECURITY INCIDENT ALERT</div>
                <div class="alert-title">Covered Face Departure Flagged</div>
            </div>
            <div class="body">
                <p>Hello <strong>{teacher_name}</strong>,</p>
                <p>An individual crossed the classroom exit boundary with an intentionally <strong>covered / concealed face</strong> during your active class period.</p>
                
                <div class="meta-box">
                    <div>Location: <strong>{classroom}</strong></div>
                    <div>Exact Timestamp: <strong>{timestamp_str}</strong></div>
                    <div>Suspected Profile: <strong style="color: #f87171;">{suspected_student_name}</strong> (Disappeared from active seats)</div>
                </div>

                <div class="img-box">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">PHOTOGRAPHIC PROOF CAPTURE:</div>
                    <img src="{photo_proof_base64}" alt="Photographic Proof" />
                </div>

                <p style="font-size: 12px; color: #94a3b8;">
                    This incident has been logged in the system security audit ledger and flagged on your Teacher Dashboard for review.
                </p>
            </div>
            <div class="footer">
                Automated Incident Alert &bull; Smart CCTV Attendance Ledger Security System
            </div>
        </div>
    </body>
    </html>
    """

    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials missing; skipping live security alert email dispatch.")
        return True

    if async_send:
        thread = threading.Thread(
            target=_dispatch_raw_smtp,
            args=(to_email, subject, html_content, f"Security Alert: Covered Face Exit in {classroom}"),
            daemon=True
        )
        thread.start()
        return True
    else:
        _dispatch_raw_smtp(to_email, subject, html_content, f"Security Alert: Covered Face Exit in {classroom}")
        return True
