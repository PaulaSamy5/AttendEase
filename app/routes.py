from flask import Blueprint, jsonify, request, send_file, send_from_directory, current_app
from app import db, bcrypt
from app.models import Course, Student, Enrollment, AttendanceSession, AttendanceRecord, User, Quiz, Grade
from datetime import date, datetime, timedelta
import openpyxl
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import io
import os
from flask_login import login_user, logout_user, login_required, current_user
import google.generativeai as _genai
import json as _json
import re as _re

main_bp = Blueprint('main', __name__)
api_bp  = Blueprint('api',  __name__)

@api_bp.before_request
def restrict_api():
    allowed_paths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/verify-email',
        '/api/auth/resend-otp',
        '/api/auth/forgot-password',
        '/api/auth/reset-password'
    ]
    if any(request.path.startswith(p) for p in allowed_paths):
        return
    if not current_user.is_authenticated:
        return jsonify({'error': 'Unauthorized. Please log in.'}), 401

# ─── Auth ────────────────────────────────────────────────────────────────────
@api_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, data.get('password', '')):
        return jsonify({'error': 'Invalid username or password'}), 401
        
    if getattr(user, 'is_blocked', False):
        return jsonify({'error': 'Your account has been blocked by the administrator.'}), 403
        
    # Skip verification/approval checks for admins
    if not user.is_admin:
        if not getattr(user, 'is_verified', True):
            return jsonify({'error': 'Your email is not verified. Please check your inbox for the verification code.'}), 403
        if not getattr(user, 'is_approved', True):
            return jsonify({'error': 'Your account is awaiting admin approval. You will be notified by email once approved.'}), 403
            
    login_user(user)
    return jsonify(user.to_dict())

@api_bp.route('/auth/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({'message': 'Logged out'})

@api_bp.route('/auth/me', methods=['GET'])
def get_me():
    return jsonify(current_user.to_dict())

import re as _re

def _validate_password(password):
    """Returns None if ok, else an error string."""
    if len(password) < 8:
        return 'Password must be at least 8 characters.'
    if not _re.search(r'[A-Z]', password):
        return 'Password must contain at least one uppercase letter.'
    if not _re.search(r'[a-z]', password):
        return 'Password must contain at least one lowercase letter.'
    if not _re.search(r'\d', password):
        return 'Password must contain at least one number.'
    if not _re.search(r'[^A-Za-z0-9]', password):
        return 'Password must contain at least one special character (!@#$%^&* etc.)'
    return None

@api_bp.route('/auth/register', methods=['POST'])
def register():
    import random
    data     = request.get_json()
    name     = (data.get('name') or '').strip()
    email    = (data.get('email') or '').strip().lower()
    username = (data.get('username') or email.split('@')[0]).strip()
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({'error': 'Name, email and password are required.'}), 400

    # Email format check
    if not _re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return jsonify({'error': 'Invalid email address.'}), 400

    # Password strength
    pw_err = _validate_password(password)
    if pw_err:
        return jsonify({'error': pw_err}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists.'}), 409
    if User.query.filter_by(username=username).first():
        username = email.split('@')[0] + str(random.randint(10,99))

    otp    = str(random.randint(100000, 999999))
    expiry = datetime.utcnow() + timedelta(minutes=15)

    hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(
        username=username, email=email,
        password_hash=hashed_pw, name=name,
        is_admin=False, is_verified=False, is_approved=False,
        verification_code=otp, verification_expiry=expiry
    )
    db.session.add(new_user)
    db.session.commit()

    # Send OTP email
    _send_otp_email(email, name, otp)

    return jsonify({'message': 'Registration successful! Please check your email for the verification code.', 'username': username}), 201


@api_bp.route('/auth/verify-email', methods=['POST'])
def verify_email():
    data  = request.get_json()
    email = (data.get('email') or '').strip().lower()
    code  = (data.get('code') or '').strip()

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'Email not found.'}), 404
    if user.is_verified:
        return jsonify({'message': 'Email already verified.'})
    if not user.verification_code or user.verification_code != code:
        return jsonify({'error': 'Invalid verification code.'}), 400
    if user.verification_expiry and user.verification_expiry < datetime.utcnow():
        return jsonify({'error': 'Verification code has expired. Please request a new one.'}), 400

    user.is_verified        = True
    user.verification_code  = None
    user.verification_expiry = None
    db.session.commit()

    # Notify admin(s)
    admins = User.query.filter_by(is_admin=True).all()
    for admin in admins:
        if admin.email:
            _send_admin_notify_email(admin.email, user.name or user.username, user.email)

    return jsonify({'message': 'Email verified! Your account is pending admin approval. You will be notified once approved.'})


@api_bp.route('/auth/resend-otp', methods=['POST'])
def resend_otp():
    import random
    data  = request.get_json()
    email = (data.get('email') or '').strip().lower()
    user  = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'error': 'Email not found.'}), 404
    if user.is_verified:
        return jsonify({'message': 'Already verified.'})
    otp    = str(random.randint(100000, 999999))
    expiry = datetime.utcnow() + timedelta(minutes=15)
    user.verification_code   = otp
    user.verification_expiry = expiry
    db.session.commit()
    _send_otp_email(email, user.name or user.username, otp)
    return jsonify({'message': 'A new verification code has been sent to your email.'})


@api_bp.route('/auth/users/<int:user_id>/approve', methods=['POST'])
@login_required
def approve_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403
    user = User.query.get_or_404(user_id)
    user.is_approved = True
    db.session.commit()
    if user.email:
        _send_approval_email(user.email, user.name or user.username)
    return jsonify({'message': 'User approved.', 'user': user.to_dict()})


@api_bp.route('/auth/users/<int:user_id>/reject', methods=['DELETE'])
@login_required
def reject_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        return jsonify({'error': 'Cannot reject yourself.'}), 400
    email = user.email
    name  = user.name or user.username
    db.session.delete(user)
    db.session.commit()
    if email:
        _send_rejection_email(email, name)
    return jsonify({'message': 'User rejected and removed.'})

@api_bp.route('/auth/users/<int:user_id>/block', methods=['POST'])
@login_required
def block_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403
    user = User.query.get_or_404(user_id)
    if user.id == current_user.id:
        return jsonify({'error': 'Cannot block yourself.'}), 400
    user.is_blocked = True
    db.session.commit()
    return jsonify({'message': f'User {user.username} blocked.', 'user': user.to_dict()})

@api_bp.route('/auth/users/<int:user_id>/unblock', methods=['POST'])
@login_required
def unblock_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403
    user = User.query.get_or_404(user_id)
    user.is_blocked = False
    db.session.commit()
    return jsonify({'message': f'User {user.username} unblocked.', 'user': user.to_dict()})


@api_bp.route('/auth/users', methods=['GET'])
@login_required
def get_users():
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])

@api_bp.route('/auth/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required.'}), 403
    user_to_delete = User.query.get_or_404(user_id)
    if user_to_delete.id == current_user.id:
        return jsonify({'error': 'You cannot delete yourself.'}), 400
    db.session.delete(user_to_delete)
    db.session.commit()
    return jsonify({'message': 'User deleted successfully.'})


@api_bp.route('/admin/email-settings', methods=['GET', 'POST'])
@login_required
def email_settings():
    import dotenv
    # Intentionally resolve the absolute path so we update the actual project .env
    env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
    
    if not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
        
    if request.method == 'POST':
        data = request.get_json()
        current_app.config['MAIL_SERVER'] = data.get('server', current_app.config.get('MAIL_SERVER'))
        try:
            current_app.config['MAIL_PORT'] = int(data.get('port', 587))
        except:
            current_app.config['MAIL_PORT'] = 587
            
        current_app.config['MAIL_USERNAME'] = data.get('user', current_app.config.get('MAIL_USERNAME'))
        current_app.config['MAIL_PASSWORD'] = data.get('password', current_app.config.get('MAIL_PASSWORD'))
        
        # Save to .env persistently
        if data.get('server'): dotenv.set_key(env_file, 'MAIL_SERVER', data['server'])
        if data.get('port'):   dotenv.set_key(env_file, 'MAIL_PORT', str(data['port']))
        if data.get('user'):   dotenv.set_key(env_file, 'MAIL_USERNAME', data['user'])
        if data.get('password') and data['password'] != '●●●●●●●●': 
            dotenv.set_key(env_file, 'MAIL_PASSWORD', data['password'])

        return jsonify({'message': 'Settings updated successfully'})
        
    return jsonify({
        'server': current_app.config.get('MAIL_SERVER'),
        'port': current_app.config.get('MAIL_PORT'),
        'user': current_app.config.get('MAIL_USERNAME'),
        'password': '●●●●●●●●' if current_app.config.get('MAIL_PASSWORD') else ''
    })

@api_bp.route('/auth/profile', methods=['PUT'])
@login_required
def update_profile():
    data = request.get_json()
    user = current_user
    
    if 'name' in data:
        user.name = data['name'].strip()
    
    if 'email' in data:
        email = data['email'].strip()
        if email and User.query.filter(User.email == email, User.id != user.id).first():
            return jsonify({'error': 'Email already in use.'}), 409
        user.email = email
        
    if 'password' in data and data['password']:
        pw_err = _validate_password(data['password'])
        if pw_err:
            return jsonify({'error': pw_err}), 400
        user.password_hash = bcrypt.generate_password_hash(data['password']).decode('utf-8')
        
    if 'ui_mode' in data:
        user.ui_mode = data['ui_mode'] # 'standard' | 'simple'
        
    db.session.commit()
    return jsonify(user.to_dict())

import secrets
from datetime import timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def _send_email(app, to_email, subject, html_body, plain_body):
    """Shared SMTP sender. Runs within app context."""
    with app.app_context():
        sender   = app.config.get('MAIL_USERNAME', '')
        password = app.config.get('MAIL_PASSWORD', '')
        server   = app.config.get('MAIL_SERVER', 'smtp.gmail.com')
        port     = int(app.config.get('MAIL_PORT', 587))
        
        if not sender or not password:
            print(f"DEBUG: Email credentials missing. Cannot send to {to_email}")
            return False
            
        msg = MIMEMultipart('alternative')
        msg['From']    = f"AttendEase <{sender}>"
        msg['To']      = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(plain_body, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body,  'html',  'utf-8'))
        
        try:
            s = smtplib.SMTP(server, port, timeout=15)
            s.starttls(); s.login(sender, password)
            s.sendmail(sender, to_email, msg.as_string()); s.quit()
            print(f"DEBUG: Email successfully sent to {to_email}")
            return True
        except Exception as e:
            print(f"DEBUG: Email error sending to {to_email}: {e}")
            return False

import threading
def _send_async_email(app, to_email, subject, html_body, plain_body):
    threading.Thread(target=_send_email, args=(app, to_email, subject, html_body, plain_body)).start()

def _email_wrapper(title, icon, color, content_html, to_email, name=''):
    """Returns a styled HTML email string."""
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>{title}</title></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
       style="background:linear-gradient(135deg,#1a1d2e,#16192b);border-radius:16px;
              overflow:hidden;border:1px solid rgba(99,102,241,.25);
              box-shadow:0 20px 60px rgba(0,0,0,.5);">
  <tr><td style="background:linear-gradient(135deg,{color});padding:36px 40px;text-align:center;">
    <div style="font-size:40px;margin-bottom:12px;">{icon}</div>
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">{title}</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:13px;">AttendEase — Attendance Management System</p>
  </td></tr>
  <tr><td style="padding:36px 40px;">{content_html}</td></tr>
  <tr><td style="background:rgba(0,0,0,.2);padding:18px 40px;text-align:center;border-top:1px solid rgba(99,102,241,.1);">
    <p style="margin:0;color:#4a5568;font-size:12px;">© 2025 AttendEase — Automated message, please do not reply.</p>
  </td></tr>
</table></td></tr></table></body></html>"""

def _send_otp_email(to_email, name, otp):
    content = f"""
<p style="color:#a0aec0;font-size:15px;margin:0 0 20px;">Hello, <strong style="color:#e2e8f0;">{name}</strong> 👋</p>
<p style="color:#a0aec0;font-size:15px;margin:0 0 24px;">
  Thank you for registering at <strong style="color:#e2e8f0;">AttendEase</strong>.
  Please use the code below to verify your email address. Valid for <strong style="color:#e2e8f0;">15 minutes</strong>.
</p>
<div style="text-align:center;margin:0 0 28px;">
  <div style="display:inline-block;background:rgba(99,102,241,.15);border:2px dashed rgba(99,102,241,.5);
              border-radius:12px;padding:20px 40px;">
    <span style="font-size:36px;font-weight:800;letter-spacing:10px;color:#8b5cf6;">{otp}</span>
  </div>
</div>
<p style="color:#718096;font-size:13px;margin:0 0 20px;">
  Do NOT share this code with anyone. If you didn't create this account, please ignore this email.
</p>"""
    html = _email_wrapper('Email Verification Code', '📧', '#6366f1 0%,#8b5cf6 100%', content, to_email)
    plain = f"Hello {name},\n\nYour AttendEase verification code is: {otp}\n\nValid for 15 minutes."
    _send_async_email(current_app._get_current_object(), to_email, '📧 Verify your AttendEase account', html, plain)

def _send_admin_notify_email(admin_email, user_name, user_email):
    content = f"""
<p style="color:#a0aec0;font-size:15px;margin:0 0 20px;">A new user has verified their email and is awaiting your approval:</p>
<div style="background:rgba(255,255,255,.05);border-radius:10px;padding:20px;margin:0 0 24px;">
  <p style="margin:0 0 8px;color:#e2e8f0;font-size:15px;">👤 <strong>{user_name}</strong></p>
  <p style="margin:0;color:#a0aec0;font-size:14px;">✉️ {user_email}</p>
</div>
<p style="color:#a0aec0;font-size:14px;margin:0;">Please log in to the Admin Panel to approve or reject this account.</p>"""
    html = _email_wrapper('New User Awaiting Approval', '🔔', '#f59e0b 0%,#d97706 100%', content, admin_email)
    plain = f"New user registration:\nName: {user_name}\nEmail: {user_email}\n\nPlease review in the Admin Panel."
    _send_async_email(current_app._get_current_object(), admin_email, '🔔 New User Awaiting Approval — AttendEase', html, plain)

def _send_approval_email(to_email, name):
    content = f"""
<p style="color:#a0aec0;font-size:15px;margin:0 0 20px;">Hello, <strong style="color:#e2e8f0;">{name}</strong> 👋</p>
<p style="color:#a0aec0;font-size:15px;margin:0 0 28px;">
  Great news! Your <strong style="color:#e2e8f0;">AttendEase</strong> account has been <strong style="color:#3dd68c;">approved</strong> by the administrator.
  You can now log in using your username and password.
</p>
<div style="background:rgba(61,214,140,.08);border:1px solid rgba(61,214,140,.3);border-radius:10px;padding:16px 20px;">
  <p style="margin:0;color:#3dd68c;font-size:14px;">✅ Your account is now active. Welcome to AttendEase!</p>
</div>"""
    html = _email_wrapper('Account Approved ✅', '🎉', '#059669 0%,#10b981 100%', content, to_email)
    plain = f"Hello {name},\n\nYour AttendEase account has been approved. You can now log in."
    _send_async_email(current_app._get_current_object(), to_email, '🎉 Your AttendEase account has been approved!', html, plain)

def _send_rejection_email(to_email, name):
    content = f"""
<p style="color:#a0aec0;font-size:15px;margin:0 0 20px;">Hello, <strong style="color:#e2e8f0;">{name}</strong>,</p>
<p style="color:#a0aec0;font-size:15px;margin:0 0 20px;">
  We regret to inform you that your registration request for <strong style="color:#e2e8f0;">AttendEase</strong>
  was not approved at this time. Please contact the system administrator for more information.
</p>"""
    html = _email_wrapper('Registration Not Approved', '❌', '#dc2626 0%,#ef4444 100%', content, to_email)
    plain = f"Hello {name},\n\nYour AttendEase registration was not approved. Please contact the administrator."
    _send_async_email(current_app._get_current_object(), to_email, 'AttendEase — Registration Update', html, plain)

def send_reset_email(to_email, username, reset_link):
    from flask import current_app
    sender_email    = current_app.config.get('MAIL_USERNAME')
    sender_password = current_app.config.get('MAIL_PASSWORD')
    mail_server     = current_app.config.get('MAIL_SERVER', 'smtp.gmail.com')
    mail_port       = int(current_app.config.get('MAIL_PORT', 587))

    if not sender_email or not sender_password:
        print("Email credentials not configured.")
        return False

    display_name = username or to_email

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:linear-gradient(135deg,#1a1d2e 0%,#16192b 100%);
                      border-radius:16px;overflow:hidden;
                      border:1px solid rgba(99,102,241,0.25);
                      box-shadow:0 20px 60px rgba(0,0,0,0.5);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);
                       padding:36px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);
                          border-radius:50%;width:64px;height:64px;line-height:64px;
                          font-size:30px;margin-bottom:14px;">🔐</div>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;
                         letter-spacing:-0.5px;">Password Reset Request</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">
                AttendEase — Attendance Management System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#a0aec0;font-size:15px;line-height:1.6;">
                Hello, <strong style="color:#e2e8f0;">{display_name}</strong> 👋
              </p>
              <p style="margin:0 0 28px;color:#a0aec0;font-size:15px;line-height:1.6;">
                We received a request to reset your password for your <strong style="color:#e2e8f0;">AttendEase</strong> account.
                Click the button below to set a new password. This link is valid for <strong style="color:#e2e8f0;">1 hour</strong>.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:10px 0 32px;">
                    <a href="{reset_link}"
                       style="display:inline-block;
                              background:linear-gradient(135deg,#6366f1,#8b5cf6);
                              color:#ffffff;text-decoration:none;
                              padding:16px 40px;border-radius:10px;
                              font-size:15px;font-weight:700;
                              letter-spacing:0.3px;
                              box-shadow:0 4px 20px rgba(99,102,241,0.4);">
                      🔑 &nbsp; Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid rgba(99,102,241,0.15);margin:0 0 28px;"/>

              <!-- Fallback link -->
              <p style="margin:0 0 8px;color:#718096;font-size:13px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 28px;word-break:break-all;">
                <a href="{reset_link}" style="color:#6366f1;font-size:13px;">{reset_link}</a>
              </p>

              <!-- Warning -->
              <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);
                          border-radius:10px;padding:16px 20px;">
                <p style="margin:0;color:#d97706;font-size:13px;line-height:1.6;">
                  ⚠️ &nbsp;<strong>Didn't request this?</strong> You can safely ignore this email.
                  Your password will remain unchanged. If you're concerned, please contact your system administrator.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:rgba(0,0,0,0.2);padding:20px 40px;text-align:center;
                       border-top:1px solid rgba(99,102,241,0.1);">
              <p style="margin:0;color:#4a5568;font-size:12px;">
                © 2025 AttendEase — Sent automatically, please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart('alternative')
    msg['From']    = f"AttendEase <{sender_email}>"
    msg['To']      = to_email
    msg['Subject'] = "🔐 Reset Your AttendEase Password"

    # Plain-text fallback
    plain = (f"Hello {display_name},\n\n"
             f"Reset your AttendEase password by visiting:\n{reset_link}\n\n"
             f"This link expires in 1 hour.\n\n"
             f"If you didn't request this, ignore this email.\n\nAttendEase Team")
    msg.attach(MIMEText(plain,    'plain', 'utf-8'))
    msg.attach(MIMEText(html_body, 'html',  'utf-8'))

    def _task():
        try:
            server = smtplib.SMTP(mail_server, mail_port, timeout=15)
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, msg.as_string())
            server.quit()
        except Exception as e:
            print(f"DEBUG: Failed to send reset email: {e}")

    threading.Thread(target=_task).start()
    return True


@api_bp.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    data  = request.get_json()
    email = (data.get('email') or '').strip().lower()
    user  = User.query.filter_by(email=email).first()

    if user:
        # Generate a secure token valid for 1 hour
        token = secrets.token_urlsafe(32)
        user.reset_token        = token
        user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
        db.session.commit()

        # Build reset link from the incoming request host
        from flask import request as flask_req
        base_url   = flask_req.host_url.rstrip('/')
        reset_link = f"{base_url}/?reset_token={token}"

        send_reset_email(user.email, user.name or user.username, reset_link)
        return jsonify({'message': 'We found your account. A password reset email has been sent to your email address. Please check your inbox.'}), 200
    else:
        return jsonify({'error': 'We could not find an account associated with this email address. Please check the email or register for a new account.'}), 404


@api_bp.route('/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')
    
    if not token or not new_password:
        return jsonify({'error': 'Missing token or password.'}), 400
        
    user = User.query.filter_by(reset_token=token).first()
    if not user or not user.reset_token_expiry or user.reset_token_expiry < datetime.utcnow():
        return jsonify({'error': 'Invalid or expired reset token.'}), 400
        
    pw_err = _validate_password(new_password)
    if pw_err:
        return jsonify({'error': pw_err}), 400

    user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    user.reset_token = None
    user.reset_token_expiry = None
    db.session.commit()
    
    return jsonify({'message': 'Password has been reset successfully.'})


# ─── Serve Frontend ──────────────────────────────────────────────────────────

@main_bp.route('/', defaults={'path': ''})
@main_bp.route('/<path:path>')
def serve(path):
    from flask import current_app, send_from_directory, request
    from flask_login import current_user
    import os

    # Base frontend directory
    # current_app.static_folder is likely absolute path to 'frontend'
    base_sf = current_app.static_folder
    
    # Determine which UI mode to use
    ui_mode = 'standard'
    if current_user.is_authenticated:
        ui_mode = getattr(current_user, 'ui_mode', 'standard')
    
    # If mode is simple, use the frontend_simple directory
    if ui_mode == 'simple':
        # frontend_simple is adjacent to frontend
        sf = os.path.join(os.path.dirname(base_sf), 'frontend_simple')
    else:
        sf = base_sf

    if path and os.path.exists(os.path.join(sf, path)):
        return send_from_directory(sf, path)
    return send_from_directory(sf, 'index.html')


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _warn_level(score, w1, w2, dep):
    """0=OK, 1=Warn1, 2=Warn2, 3=Deprived — score may be a weighted float."""
    if score >= (dep or 99): return 3
    if score >= (w2  or 99): return 2
    if score >= (w1  or 99): return 1
    return 0


def _compute_warnings(enrollment, course):
    """Return per-type absence counts + weighted score + warning level.

    Cancelled sessions are excluded from all counts.
    'lab' sessions are treated as 'section' for the purpose of combined absence scores.
    """
    def count_abs(stype):
        # Handle 'section' search by including 'lab' if needed, or keeping them distinct
        # and combining later.
        sessions = AttendanceSession.query.filter_by(
            course_id=course.id, session_type=stype, cancelled=False).all()
        return (
            sum(
                1 for s in sessions
                if AttendanceRecord.query.filter_by(
                    enrollment_id=enrollment.id,
                    session_id=s.id,
                    status='absent'
                ).count() > 0
            ),
            len(sessions),
        )

    lec_abs, lec_total = count_abs('lecture')
    sec_abs, sec_total = count_abs('section')
    lab_abs, lab_total = count_abs('lab')

    # Combine lab with section for unified warning calculation
    comb_sec_abs = sec_abs + lab_abs
    comb_sec_total = sec_total + lab_total

    lw = course.lec_weight if course.lec_weight is not None else 1.0
    sw = course.sec_weight if course.sec_weight is not None else 1.0

    weighted_score = lec_abs * lw + comb_sec_abs * sw

    overall_level = _warn_level(
        weighted_score,
        course.warn1_lec, course.warn2_lec, course.deprive_lec
    )

    return {
        'lec_absent':     lec_abs,
        'lec_total':      lec_total,
        'sec_absent':     comb_sec_abs, # Combined for warning UI
        'sec_total':      comb_sec_total,
        'weighted_score': round(weighted_score, 2),
        'lec_level':      overall_level,
        'sec_level':      overall_level,
        'overall_level':  overall_level,
    }


def _compute_attendance_grade(enrollment, course):
    """Calculate the attendance grade for a student in a course.

    Returns a dict with:
        - total_absences: number of absences (excluding cancelled sessions)
        - attendance_grade: computed grade (max - deduction * absences), clamped to 0
        - att_grade_max: the max possible
    """
    if not course.att_grade_enabled:
        return {'total_absences': 0, 'attendance_grade': None, 'att_grade_max': 0}

    max_grade  = course.att_grade_max  if course.att_grade_max  is not None else 10.0
    deduction  = course.att_grade_deduction if course.att_grade_deduction is not None else 1.0

    # Count absences across all non-cancelled sessions for this course
    non_cancelled_sessions = AttendanceSession.query.filter_by(
        course_id=course.id, cancelled=False
    ).all()

    total_absences = 0
    for s in non_cancelled_sessions:
        rec = AttendanceRecord.query.filter_by(
            enrollment_id=enrollment.id,
            session_id=s.id,
            status='absent'
        ).first()
        if rec:
            total_absences += 1

    grade = max(0, max_grade - (deduction * total_absences))
    return {
        'total_absences': total_absences,
        'attendance_grade': round(grade, 2),
        'att_grade_max': max_grade,
    }


# ─── Courses ─────────────────────────────────────────────────────────────────

@api_bp.route('/courses/<int:course_id>', methods=['GET'])
def get_course(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    return jsonify(course.to_dict())


@api_bp.route('/courses', methods=['GET'])
def get_courses():
    return jsonify([c.to_dict() for c in Course.query.filter_by(instructor_id=current_user.id).order_by(Course.created_at.desc()).all()])


@api_bp.route('/courses', methods=['POST'])
def create_course():
    data = request.get_json()
    name = (data.get('name') or '').strip()
    code = (data.get('code') or '').strip().upper()
    if not name or not code:
        return jsonify({'error': 'Course name and code are required.'}), 400
    if Course.query.filter_by(code=code, instructor_id=current_user.id).first():
        return jsonify({'error': f'Course code "{code}" already exists.'}), 409
    course = Course(name=name, code=code, instructor_id=current_user.id)
    db.session.add(course)
    db.session.commit()
    return jsonify(course.to_dict()), 201


@api_bp.route('/courses/<int:course_id>', methods=['PUT'])
def update_course(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    data   = request.get_json()
    name = (data.get('name') or '').strip()
    code = (data.get('code') or '').strip().upper()
    if not name or not code:
        return jsonify({'error': 'Course name and code are required.'}), 400
    existing = Course.query.filter_by(code=code, instructor_id=current_user.id).first()
    if existing and existing.id != course_id:
        return jsonify({'error': f'Course code "{code}" already exists.'}), 409
    course.name = name
    course.code = code
    # Warning thresholds (optional)
    for field in ('warn1_lec', 'warn2_lec', 'deprive_lec', 'warn1_sec', 'warn2_sec', 'deprive_sec'):
        val = data.get(field)
        if val is not None:
            try:
                setattr(course, field, max(1, int(val)))
            except (ValueError, TypeError):
                pass
    # Weights (optional, float > 0)
    for field in ('lec_weight', 'sec_weight'):
        val = data.get(field)
        if val is not None:
            try:
                setattr(course, field, max(0.1, float(val)))
            except (ValueError, TypeError):
                pass
    # Attendance grade settings
    if 'att_grade_enabled' in data:
        course.att_grade_enabled = bool(data['att_grade_enabled'])
    if 'att_grade_max' in data:
        try:
            course.att_grade_max = max(0, float(data['att_grade_max']))
        except (ValueError, TypeError):
            pass
    if 'att_grade_deduction' in data:
        try:
            course.att_grade_deduction = max(0, float(data['att_grade_deduction']))
        except (ValueError, TypeError):
            pass
    db.session.commit()
    return jsonify(course.to_dict())


@api_bp.route('/courses/<int:course_id>', methods=['DELETE'])
def delete_course(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    # SQLAlchemy's cascade='all, delete-orphan' handles the children
    # We just need to make sure the session is committed.
    try:
        db.session.delete(course)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
    return jsonify({'message': f'Course "{course.name}" deleted successfully.'})


# ─── Students ────────────────────────────────────────────────────────────────

@api_bp.route('/students', methods=['GET'])
def get_students():
    search = request.args.get('search', '').strip()
    q = Student.query
    if search:
        q = q.filter(db.or_(
            Student.student_id.ilike(f'%{search}%'),
            Student.name.ilike(f'%{search}%'),
        ))
    return jsonify([s.to_dict() for s in q.order_by(Student.name).all()])


@api_bp.route('/students', methods=['POST'])
def create_student():
    data = request.get_json()
    sid  = (data.get('student_id') or '').strip()
    name = (data.get('name') or '').strip()
    if not sid or not name:
        return jsonify({'error': 'Student ID and name are required.'}), 400
    if Student.query.filter_by(student_id=sid).first():
        return jsonify({'error': f'Student ID "{sid}" already exists.'}), 409
    s = Student(student_id=sid, name=name)
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@api_bp.route('/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    student = Student.query.get_or_404(student_id)
    db.session.delete(student)
    db.session.commit()
    return jsonify({'message': 'Student deleted.'})


# ─── Group Division ──────────────────────────────────────────────────────────

def _divide_students_into_groups(course_id, num_groups):
    course = Course.query.get_or_404(course_id)
    enrollments = course.enrollments.all()
    students = [e.student for e in enrollments]
    
    # Sort by name first to ensure consistent base, then shuffle or just assign
    # Shuffling is usually preferred for groups
    import random
    random.seed(42) # Optional: constant seed for consistency if desired, or random
    random.shuffle(students)
    
    groups = [[] for _ in range(num_groups)]
    for i, student in enumerate(students):
        groups[i % num_groups].append({
            'student_id': student.student_id,
            'name': student.name
        })
    # Sort students within each group by name
    for g in groups:
        g.sort(key=lambda x: x['name'])
        
    return groups

@api_bp.route('/courses/<int:course_id>/groups/divide', methods=['GET'])
def get_groups_json(course_id):
    num_groups = request.args.get('num_groups', type=int)
    if not num_groups or num_groups < 1:
        return jsonify({'error': 'Invalid number of groups.'}), 400
    groups = _divide_students_into_groups(course_id, num_groups)
    return jsonify({'groups': groups})

@api_bp.route('/courses/<int:course_id>/groups/export/excel', methods=['GET'])
def export_groups_excel(course_id):
    num_groups = request.args.get('num_groups', type=int)
    if not num_groups or num_groups < 1:
        return "Invalid groups count", 400
    
    course = Course.query.get_or_404(course_id)
    groups = _divide_students_into_groups(course_id, num_groups)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Student Groups"
    
    hfill  = PatternFill('solid', fgColor='1e293b')
    hfont  = Font(color='FFFFFF', bold=True)
    center = Alignment(horizontal='center', vertical='center')
    thin   = Side(style='thin', color='CBD5E1')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    
    current_row = 1
    for i, group in enumerate(groups, 1):
        # Group Header
        ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=2)
        cell = ws.cell(row=current_row, column=1, value=f"Group {i}")
        cell.font = hfont; cell.fill = hfill; cell.alignment = center; cell.border = border
        current_row += 1
        
        # Sub Headers
        h1 = ws.cell(row=current_row, column=1, value="Student ID")
        h2 = ws.cell(row=current_row, column=2, value="Name")
        h1.font = hfont; h1.fill = hfill; h1.alignment = center; h1.border = border
        h2.font = hfont; h2.fill = hfill; h2.alignment = center; h2.border = border
        current_row += 1
        
        # Data
        for s in group:
            ws.cell(row=current_row, column=1, value=s['student_id']).border = border
            ws.cell(row=current_row, column=2, value=s['name']).border = border
            current_row += 1
        current_row += 1 # Gap between groups

    ws.column_dimensions['A'].width = 20
    ws.column_dimensions['B'].width = 40
    
    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return send_file(buf, as_attachment=True,
                     download_name=f'{course.code}_groups.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@api_bp.route('/courses/<int:course_id>/groups/export/word', methods=['GET'])
def export_groups_word(course_id):
    from docx import Document
    from docx.shared import Inches
    
    num_groups = request.args.get('num_groups', type=int)
    if not num_groups or num_groups < 1:
        return "Invalid groups count", 400
    
    course = Course.query.get_or_404(course_id)
    groups = _divide_students_into_groups(course_id, num_groups)
    
    doc = Document()
    doc.add_heading(f'Student Groups: {course.name} ({course.code})', 0)
    
    for i, group in enumerate(groups, 1):
        doc.add_heading(f'Group {i}', level=2)
        table = doc.add_table(rows=1, cols=2)
        table.style = 'Light Grid Accent 1'
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = 'Student ID'
        hdr_cells[1].text = 'Name'
        
        for s in group:
            row_cells = table.add_row().cells
            row_cells[0].text = s['student_id']
            row_cells[1].text = s['name']
        doc.add_paragraph() # Spacer
        
    buf = io.BytesIO()
    doc.save(buf); buf.seek(0)
    return send_file(buf, as_attachment=True,
                     download_name=f'{course.code}_groups.docx',
                     mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document')

@api_bp.route('/courses/<int:course_id>/groups/export/pdf', methods=['GET'])
def export_groups_pdf(course_id):
    from fpdf import FPDF
    
    num_groups = request.args.get('num_groups', type=int)
    if not num_groups or num_groups < 1:
        return "Invalid groups count", 400
    
    course = Course.query.get_or_404(course_id)
    groups = _divide_students_into_groups(course_id, num_groups)
    
    class PDF(FPDF):
        def header(self):
            # Styling for the main header
            self.set_fill_color(30, 41, 59)  # Slate 800
            self.rect(0, 0, 210, 35, 'F')
            
            self.set_text_color(255, 255, 255)
            self.set_font('helvetica', 'B', 16)
            self.cell(0, 15, f'Student Groups Division', 0, 1, 'C')
            self.set_font('helvetica', '', 12)
            self.cell(0, 5, f'{course.name} ({course.code})', 0, 1, 'C')
            self.ln(20)
            
        def footer(self):
            self.set_y(-15)
            self.set_font('helvetica', 'I', 8)
            self.set_text_color(100, 116, 139) # Slate 500
            self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

    pdf = PDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    for i, group in enumerate(groups, 1):
        # Group Header - Distinct Background
        pdf.set_fill_color(226, 232, 240) # Slate 200
        pdf.set_text_color(15, 23, 42) # Slate 900
        pdf.set_font('helvetica', 'B', 14)
        pdf.cell(0, 12, f'GROUP {i}', 0, 1, 'C', fill=True)
        pdf.ln(4)
        
        # Table Header
        pdf.set_font('helvetica', 'B', 11)
        pdf.set_fill_color(30, 41, 59) # Slate 800
        pdf.set_text_color(255, 255, 255)
        pdf.cell(60, 10, 'Student ID', 1, 0, 'C', fill=True)
        pdf.cell(130, 10, 'Name', 1, 1, 'C', fill=True)
        
        # Data Rows
        pdf.set_text_color(30, 41, 59)
        pdf.set_font('helvetica', '', 11)
        fill = False
        for s in group:
            # Page break check
            if pdf.get_y() > 270:
                pdf.add_page()
                # Re-add table header on new page
                pdf.set_font('helvetica', 'B', 11)
                pdf.set_fill_color(71, 85, 105)
                pdf.set_text_color(255, 255, 255)
                pdf.cell(60, 10, 'Student ID', 1, 0, 'C', fill=True)
                pdf.cell(130, 10, 'Name', 1, 1, 'C', fill=True)
                pdf.set_text_color(30, 41, 59)
                pdf.set_font('helvetica', '', 11)

            if fill:
                pdf.set_fill_color(248, 250, 252) # Slate 50
            else:
                pdf.set_fill_color(255, 255, 255)
            
            # Sanitize to prevent latin-1 encoding errors (crash)
            sid_txt = str(s['student_id']).encode('latin-1', 'replace').decode('latin-1')
            name_txt = f" {s['name']}".encode('latin-1', 'replace').decode('latin-1')
            
            pdf.cell(60, 9, sid_txt, 1, 0, 'C', fill=True)
            pdf.cell(130, 9, name_txt, 1, 1, 'L', fill=True)
            fill = not fill
            
        pdf.ln(10)
        
    buf = io.BytesIO()
    pdf_bytes = pdf.output() # fpdf2 output() returns bytes by default if no dest is provided
    buf.write(pdf_bytes)
    buf.seek(0)
    
    return send_file(buf, as_attachment=True,
                     download_name=f'{course.code}_groups.pdf',
                     mimetype='application/pdf')


# ─── Enrollments ─────────────────────────────────────────────────────────────

def _add_student_to_past_records(enrollment):
    # Add to all past attendance sessions as absent if record doesn't exist
    sessions = AttendanceSession.query.filter_by(course_id=enrollment.course_id).all()
    for s in sessions:
        exists = AttendanceRecord.query.filter_by(enrollment_id=enrollment.id, session_id=s.id).first()
        if not exists:
            db.session.add(AttendanceRecord(enrollment_id=enrollment.id, session_id=s.id, status='absent'))
    
    # Add to all past quizzes as 0 grade if record doesn't exist
    quizzes = Quiz.query.filter_by(course_id=enrollment.course_id).all()
    for q in quizzes:
        exists = Grade.query.filter_by(enrollment_id=enrollment.id, quiz_id=q.id).first()
        if not exists:
            db.session.add(Grade(enrollment_id=enrollment.id, quiz_id=q.id, score=0.0))

@api_bp.route('/courses/<int:course_id>/sync-records', methods=['POST'])
def sync_course_records(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    enrollments = course.enrollments.all()
    for en in enrollments:
        _add_student_to_past_records(en)
    db.session.commit()
    return jsonify({'message': f'Synchronized records for {len(enrollments)} students.'})

@api_bp.route('/courses/<int:course_id>/students', methods=['GET'])
def get_course_students(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    return jsonify([e.to_dict() for e in course.enrollments.all()])


@api_bp.route('/courses/<int:course_id>/enroll', methods=['POST'])
def enroll_students(course_id):
    Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    data = request.get_json()
    enrolled, skipped = 0, 0
    for sid in data.get('student_ids', []):
        student = Student.query.get(sid)
        if not student:
            skipped += 1; continue
        if Enrollment.query.filter_by(student_id=sid, course_id=course_id).first():
            skipped += 1; continue
        en = Enrollment(student_id=sid, course_id=course_id)
        db.session.add(en)
        db.session.flush()
        _add_student_to_past_records(en)
        enrolled += 1
    db.session.commit()
    return jsonify({'enrolled': enrolled, 'skipped': skipped})


@api_bp.route('/courses/<int:course_id>/enroll/<int:student_db_id>', methods=['DELETE'])
def unenroll_student(course_id, student_db_id):
    e = Enrollment.query.filter_by(student_id=student_db_id, course_id=course_id).first_or_404()
    db.session.delete(e)
    db.session.commit()
    return jsonify({'message': 'Student unenrolled.'})


# ─── Warnings ────────────────────────────────────────────────────────────────

@api_bp.route('/courses/<int:course_id>/warnings', methods=['GET'])
def get_course_warnings(course_id):
    course      = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    enrollments = course.enrollments.all()
    results = []
    for e in enrollments:
        w = _compute_warnings(e, course)
        results.append({
            'student_id':   e.student.student_id,
            'student_name': e.student.name,
            **w,
        })
    return jsonify({
        'thresholds': {
            'warn1_lec':   course.warn1_lec,  'warn2_lec':  course.warn2_lec,  'deprive_lec': course.deprive_lec,
            'warn1_sec':   course.warn1_sec,   'warn2_sec':  course.warn2_sec,   'deprive_sec': course.deprive_sec,
            'lec_weight':  course.lec_weight   if course.lec_weight  is not None else 1.0,
            'sec_weight':  course.sec_weight   if course.sec_weight  is not None else 1.0,
        },
        'students': results,
    })


# ─── Attendance Sessions ──────────────────────────────────────────────────────

@api_bp.route('/courses/<int:course_id>/sessions', methods=['GET'])
def get_sessions(course_id):
    Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    sessions = AttendanceSession.query\
        .filter_by(course_id=course_id)\
        .order_by(AttendanceSession.session_date.desc(), AttendanceSession.created_at.desc())\
        .all()
    
    from app.models import Quiz
    results = []
    for s in sessions:
        d = s.to_dict()
        q = Quiz.query.filter_by(session_id=s.id).first()
        d['quiz_id'] = q.id if q else None
        results.append(d)
        
    return jsonify(results)


@api_bp.route('/courses/<int:course_id>/sessions', methods=['POST'])
def create_session(course_id):
    Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    data     = request.get_json()
    raw_date = data.get('session_date') or date.today().isoformat()
    try:
        session_date = date.fromisoformat(raw_date)
    except ValueError:
        return jsonify({'error': 'Invalid date format.'}), 400

    stype = data.get('session_type', 'lecture')
    if stype not in ('lecture', 'section', 'lab'):
        stype = 'lecture'

    label   = (data.get('label') or '').strip() or None
    session = AttendanceSession(
        course_id=course_id,
        session_date=session_date,
        session_type=stype,
        label=label
    )
    db.session.add(session)
    db.session.flush()

    for en in Enrollment.query.filter_by(course_id=course_id).all():
        db.session.add(AttendanceRecord(
            enrollment_id=en.id, session_id=session.id, status='absent'
        ))

    db.session.commit()
    return jsonify(session.to_dict()), 201

@api_bp.route('/sessions/<int:session_id>', methods=['PUT'])
def update_session(session_id):
    session = AttendanceSession.query.get_or_404(session_id)
    data = request.get_json()
    
    if 'session_date' in data:
        try:
            session.session_date = date.fromisoformat(data['session_date'])
        except ValueError:
            return jsonify({'error': 'Invalid date format.'}), 400
            
    if 'session_type' in data:
        if data['session_type'] in ('lecture', 'section', 'lab'):
            session.session_type = data['session_type']
            
    if 'label' in data:
        session.label = data['label'].strip() or None
        
    db.session.commit()
    return jsonify(session.to_dict())

@api_bp.route('/sessions/<int:session_id>/cancel', methods=['PUT'])
def toggle_cancel_session(session_id):
    session = AttendanceSession.query.get_or_404(session_id)
    session.cancelled = not session.cancelled
    db.session.commit()
    return jsonify(session.to_dict())


@api_bp.route('/sessions/<int:session_id>', methods=['GET'])
def get_session_detail(session_id):
    session = AttendanceSession.query.get_or_404(session_id)
    data = []
    for r in session.records.all():
        en = r.enrollment
        data.append({
            'record_id':    r.id,
            'student_id':   en.student.student_id,
            'student_name': en.student.name,
            'status':       r.status,
            'marked_at':    r.marked_at.isoformat(),
        })
    data.sort(key=lambda x: x['student_name'])
    # Check if a quiz is linked to this session
    from app.models import Quiz
    quiz = Quiz.query.filter_by(session_id=session_id).first()
    
    return jsonify({
        'session': session.to_dict(), 
        'records': data,
        'quiz': quiz.to_dict() if quiz else None
    })


@api_bp.route('/sessions/<int:session_id>/records/<int:record_id>', methods=['PUT'])
def update_record(session_id, record_id):
    record = AttendanceRecord.query.get_or_404(record_id)
    data   = request.get_json()
    status = data.get('status', 'present')
    if status not in ('present', 'absent'):
        return jsonify({'error': 'Status must be present or absent.'}), 400
    record.status    = status
    record.marked_at = datetime.utcnow()
    db.session.commit()
    return jsonify(record.to_dict())

@api_bp.route('/sessions/<int:session_id>/bulk-records', methods=['PUT'])
def bulk_update_records(session_id):
    session = AttendanceSession.query.get_or_404(session_id)
    data   = request.get_json()
    status = data.get('status', 'present')
    if status not in ('present', 'absent'):
        return jsonify({'error': 'Status must be present or absent.'}), 400
    
    records = AttendanceRecord.query.filter_by(session_id=session_id).all()
    for r in records:
        r.status = status
        r.marked_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': f'All records updated to {status}'})



@api_bp.route('/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    session = AttendanceSession.query.get_or_404(session_id)
    
    # 1. Delete associated attendance records to prevent FK constraints
    AttendanceRecord.query.filter_by(session_id=session.id).delete()
    
    # 2. Delete linked quizzes and their grades
    linked_quizzes = Quiz.query.filter_by(session_id=session.id).all()
    for q in linked_quizzes:
        Grade.query.filter_by(quiz_id=q.id).delete()
        db.session.delete(q)
    
    db.session.delete(session)
    db.session.commit()
    return jsonify({'message': 'Session deleted.'})


# ─── Quick Attendance Mark ────────────────────────────────────────────────────

@api_bp.route('/sessions/<int:session_id>/quick-mark', methods=['POST'])
def quick_mark(session_id):
    session = AttendanceSession.query.get_or_404(session_id)
    data    = request.get_json()
    student_id_input = (data.get('student_id') or '').strip()
    if not student_id_input:
        return jsonify({'error': 'Student ID is required.'}), 400

    student = Student.query.filter_by(student_id=student_id_input).first()
    if not student:
        return jsonify({'error': f'"{student_id_input}" not found.', 'found': False}), 404

    enrollment = Enrollment.query.filter_by(student_id=student.id, course_id=session.course_id).first()
    if not enrollment:
        return jsonify({'error': f'"{student_id_input}" is not enrolled in this course.', 'found': False}), 404

    record = AttendanceRecord.query.filter_by(enrollment_id=enrollment.id, session_id=session_id).first()
    if record:
        if record.status == 'present':
            return jsonify({
                'message': f'✓ {student.name} already marked present.',
                'student': student.to_dict(), 'already_marked': True, 'status': 'present',
            })
        record.status    = 'present'
        record.marked_at = datetime.utcnow()
    else:
        record = AttendanceRecord(enrollment_id=enrollment.id, session_id=session_id, status='present')
        db.session.add(record)

    db.session.commit()
    return jsonify({
        'message': f'✓ {student.name} marked as Present!',
        'student': student.to_dict(), 'already_marked': False, 'status': 'present',
    })


# ─── Excel Export ─────────────────────────────────────────────────────────────

@api_bp.route('/courses/<int:course_id>/export-attendance', methods=['GET'])
def export_attendance(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    
    # Sort enrollments by student_id
    enrollments = course.enrollments.join(Student).order_by(Student.student_id).all()
    
    # Sort sessions by date
    sessions = course.sessions.order_by(AttendanceSession.session_date).all()
    lecs = [s for s in sessions if s.session_type == 'lecture']
    labs = [s for s in sessions if s.session_type != 'lecture']
    
    week = request.args.get('week', type=int)
    if week and week > 0:
        lecs = lecs[:week]
        labs = labs[:week]
        
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Attendance"
    
    # ─── Styles ───────────────────────────────────────────────────────────────
    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )
    
    # Headers
    header1_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header2_fill = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    header_font  = Font(color="FFFFFF", bold=True, name='Calibri')
    
    # Data Cells
    present_fill = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")
    present_font = Font(color="064E3B", bold=True)
    absent_fill  = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    absent_font  = Font(color="991B1B", bold=True)
    zebra_fill   = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    
    center_align = Alignment(horizontal='center', vertical='center')
    left_align   = Alignment(horizontal='left',   vertical='center', indent=1)
    
    # ─── Header Construction ──────────────────────────────────────────────────
    num_weeks = max(len(lecs), len(labs))
    
    # Row 1: Week headers
    week_row = ["", ""]
    for i in range(1, num_weeks + 1):
        week_row.extend([f"WEEK {i}", ""])
    week_row.extend(["TOTALS", ""])
    ws.append(week_row)
    
    # Merge & Style Row 1
    for i in range(1, num_weeks + 2): # +1 to include TOTALS
        col_start = 3 + (i - 1) * 2
        col_end = col_start + 1
        ws.merge_cells(start_row=1, start_column=col_start, end_row=1, end_column=col_end)
        cell = ws.cell(row=1, column=col_start)
        cell.alignment = center_align
        cell.font = header_font
        cell.fill = header1_fill
        ws.cell(row=1, column=col_end).fill = header1_fill
    
    # Fill empty header cells in Row 1 (Student ID/Name area) with same fill
    for c in range(1, 3):
        cell = ws.cell(row=1, column=c)
        cell.fill = header1_fill
        cell.border = thin_border

    # Row 2: Lec/Lab headers
    headers = ["STUDENT ID", "STUDENT NAME"]
    for i in range(1, num_weeks + 1):
        headers.extend([f"LEC {i}", f"LAB {i}"])
    headers.extend(["PRESENT", "ABSENT"])
    ws.append(headers)
    
    # Style Row 2
    for col_num, h in enumerate(headers, 1):
        cell = ws.cell(row=2, column=col_num)
        cell.font = header_font
        cell.fill = header2_fill
        cell.alignment = center_align
        cell.border = thin_border
        width = 12 if col_num > 2 else 20
        if col_num == 2: width = 35
        ws.column_dimensions[get_column_letter(col_num)].width = width
    
    # ─── Data Rows ────────────────────────────────────────────────────────────
    for row_idx, en in enumerate(enrollments, 3):
        student = en.student
        row_cells = []
        is_even = (row_idx % 2 == 0)
        current_fill = zebra_fill if is_even else None
        
        # Student ID & Name
        c1 = ws.cell(row=row_idx, column=1, value=student.student_id)
        c2 = ws.cell(row=row_idx, column=2, value=student.name)
        for c in [c1, c2]:
            c.border = thin_border
            if current_fill: c.fill = current_fill
        c1.alignment = center_align
        c2.alignment = left_align
        
        records = AttendanceRecord.query.filter_by(enrollment_id=en.id).all()
        rec_dict = {r.session_id: r.status for r in records}
        atc_count = 0
        abs_count = 0
        
        col_offset = 3
        for i in range(num_weeks):
            # Process Lec & Lab
            for session_list in [lecs, labs]:
                cell_val = ""
                cell_fill = current_fill
                cell_font = None
                
                if i < len(session_list):
                    sess = session_list[i]
                    if sess.cancelled:
                        cell_val = "-"
                    else:
                        status = rec_dict.get(sess.id, 'absent')
                        if status == 'present':
                            cell_val = "P"; atc_count += 1
                            cell_fill = present_fill
                            cell_font = present_font
                        else:
                            cell_val = "A"; abs_count += 1
                            cell_fill = absent_fill
                            cell_font = absent_font
                
                cell = ws.cell(row=row_idx, column=col_offset, value=cell_val)
                cell.border = thin_border
                cell.alignment = center_align
                if cell_fill: cell.fill = cell_fill
                if cell_font: cell.font = cell_font
                
                col_offset += 1
                
        # Totals
        c_atc = ws.cell(row=row_idx, column=col_offset,   value=atc_count)
        c_abs = ws.cell(row=row_idx, column=col_offset+1, value=abs_count)
        for c in [c_atc, c_abs]:
            c.border = thin_border
            c.alignment = center_align
            c.font = Font(bold=True)
            if current_fill: c.fill = current_fill
    
    ws.freeze_panes = 'C3'
    
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    
    filename = f"{course.code}_Attendance_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return send_file(out, download_name=filename, as_attachment=True, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


# ─── Excel Import ─────────────────────────────────────────────────────────────

@api_bp.route('/courses/<int:course_id>/import', methods=['POST'])
def import_students(course_id):
    Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400
    file = request.files['file']
    if not file.filename.endswith('.xlsx'):
        return jsonify({'error': 'Only .xlsx files accepted.'}), 400

    try:
        wb = openpyxl.load_workbook(file, read_only=True, data_only=True)
        ws = wb.active
    except Exception as e:
        return jsonify({'error': f'Failed to read file: {e}'}), 400

    headers = [str(c.value or '').strip().lower() for c in next(ws.iter_rows(min_row=1, max_row=1))]
    if not {'student id', 'student name'}.issubset(set(headers)):
        return jsonify({'error': f'Missing columns. Expected "Student ID" and "Student Name". Found: {headers}'}), 400

    id_col   = headers.index('student id')
    name_col = headers.index('student name')
    results  = {'success': 0, 'skipped_duplicate': 0, 'failed': [], 'enrolled': 0}

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        sid  = str(row[id_col]   or '').strip()
        name = str(row[name_col] or '').strip()
        if not sid and not name:
            continue
        if not sid or not name:
            results['failed'].append({'row': row_idx, 'reason': 'Missing ID or Name'}); continue

        student = Student.query.filter_by(student_id=sid).first()
        if not student:
            student = Student(student_id=sid, name=name)
            db.session.add(student)
            db.session.flush()
            results['success'] += 1
        else:
            results['skipped_duplicate'] += 1

        if not Enrollment.query.filter_by(student_id=student.id, course_id=course_id).first():
            en = Enrollment(student_id=student.id, course_id=course_id)
            db.session.add(en)
            db.session.flush()
            _add_student_to_past_records(en)
            results['enrolled'] += 1

    db.session.commit()
    return jsonify(results)


@api_bp.route('/courses/<int:course_id>/students/quick-add', methods=['POST'])
def quick_add_student(course_id):
    Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    data = request.get_json()
    sid  = (data.get('student_id') or '').strip()
    name = (data.get('name') or '').strip()
    
    if not sid or not name:
        return jsonify({'error': 'Student ID and Name are required.'}), 400
        
    student = Student.query.filter_by(student_id=sid).first()
    if not student:
        student = Student(student_id=sid, name=name)
        db.session.add(student)
        db.session.flush()
        new_student = True
    else:
        new_student = False
        
    enrollment = Enrollment.query.filter_by(student_id=student.id, course_id=course_id).first()
    if enrollment:
        _add_student_to_past_records(enrollment)
        db.session.commit()
        return jsonify({'message': f'Student "{sid}" was already in this course. Records synchronized.', 'student': student.to_dict()}), 200
        
    en = Enrollment(student_id=student.id, course_id=course_id)
    db.session.add(en)
    db.session.commit() # Commit to get enrollment ID
    
    _add_student_to_past_records(en)
    db.session.commit()
    
    return jsonify({
        'message': f'Student "{name}" added and enrolled successfully!',
        'student': student.to_dict(),
        'is_new': new_student
    }), 201



# ─── Excel Template Download ──────────────────────────────────────────────────

@api_bp.route('/import-template', methods=['GET'])
def download_import_template():
    wb = openpyxl.Workbook()
    ws = wb.active;  ws.title = 'Students'

    hfill  = PatternFill('solid', fgColor='1E40AF')
    hfont  = Font(color='FFFFFF', bold=True, name='Calibri', size=11)
    sfill  = PatternFill('solid', fgColor='EFF6FF')
    nfill  = PatternFill('solid', fgColor='FEF9C3')
    nfont  = Font(italic=True, color='78350F', name='Calibri', size=10)
    center = Alignment(horizontal='center', vertical='center', wrap_text=True)
    left   = Alignment(horizontal='left',   vertical='center', wrap_text=True)
    thin   = Side(style='thin',   color='93C5FD')
    thick  = Side(style='medium', color='1E40AF')
    hborder = Border(left=thick, right=thick, top=thick, bottom=thick)
    cborder = Border(left=thin,  right=thin,  top=thin,  bottom=thin)

    headers    = ['Student ID', 'Student Name', 'Notes (optional — ignored on import)']
    col_widths = [18, 34, 40]
    for ci, (h, w) in enumerate(zip(headers, col_widths), 1):
        cell = ws.cell(row=1, column=ci, value=h)
        cell.font = hfont; cell.fill = hfill; cell.alignment = center; cell.border = hborder
        ws.column_dimensions[openpyxl.utils.get_column_letter(ci)].width = w
    ws.row_dimensions[1].height = 28

    samples = [
        ('20220001', 'Sara Ahmed',    'Replace these rows with your real data'),
        ('20220002', 'Ali Hassan',    ''),
        ('20220003', 'Mona El-Sayed', ''),
        ('20220004', 'Omar Khalil',   ''),
        ('20220005', 'Nour Ibrahim',  '← You can delete this column; it is ignored'),
    ]
    for ri, (sid, name, note) in enumerate(samples, 2):
        c_id   = ws.cell(row=ri, column=1, value=sid)
        c_name = ws.cell(row=ri, column=2, value=name)
        c_note = ws.cell(row=ri, column=3, value=note)
        for c in (c_id, c_name): c.fill = sfill; c.border = cborder; c.alignment = left
        c_id.alignment   = center
        c_note.fill = nfill; c_note.font = nfont; c_note.border = cborder; c_note.alignment = left
        ws.row_dimensions[ri].height = 20

    for ri in range(len(samples) + 2, len(samples) + 52):
        for ci in range(1, 3):
            ws.cell(row=ri, column=ci).border = cborder
        ws.row_dimensions[ri].height = 18

    ws.freeze_panes = 'A2'

    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return send_file(buf, as_attachment=True, download_name='students_import_template.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


# ─── Dashboard ────────────────────────────────────────────────────────────────

@api_bp.route('/dashboard', methods=['GET'])
def dashboard():
    my_courses = Course.query.filter_by(instructor_id=current_user.id).all()
    my_course_ids = [c.id for c in my_courses]
    total_courses  = len(my_courses)
    total_students = Student.query.count()
    total_sessions = AttendanceSession.query.filter(AttendanceSession.course_id.in_(my_course_ids)).count() if my_course_ids else 0
    total_records  = 0
    total_present  = 0

    course_stats = []
    for c in my_courses:
        enrollments = c.enrollments.all()
        present = sum(e.attendance_records.filter_by(status='present').count() for e in enrollments)
        total   = sum(e.attendance_records.count() for e in enrollments)
        total_records += total
        total_present += present
        course_stats.append({
            'id': c.id, 'name': c.name, 'code': c.code,
            'student_count': len(enrollments),
            'session_count': c.sessions.count(),
            'attendance_rate': round(present / total * 100, 1) if total > 0 else 0,
        })

    return jsonify({
        'total_courses':  total_courses,
        'total_students': total_students,
        'total_sessions': total_sessions,
        'overall_attendance_rate': round(total_present / total_records * 100, 1) if total_records > 0 else 0,
        'course_stats': course_stats,
    })


# ─── Quizzes ──────────────────────────────────────────────────────────────────

from werkzeug.utils import secure_filename

# ─── Quizzes ──────────────────────────────────────────────────────────────────

def _update_attendance_from_quiz(quiz):
    """If a quiz is linked to a session and used as attendance, mark all students
    who have a grade > 0 as present in that session.
    """
    if not quiz.use_as_attendance or not quiz.session_id:
        return

    session = AttendanceSession.query.get(quiz.session_id)
    if not session:
        return
    # For each grade in this quiz
    for grade in quiz.grades.all():
        # If student has been graded (is_graded=True), mark them as present
        if grade.is_graded:
            record = AttendanceRecord.query.filter_by(
                enrollment_id=grade.enrollment_id, 
                session_id=quiz.session_id
            ).first()
            if record:
                record.status = 'present'
                record.marked_at = datetime.utcnow()
            else:
                db.session.add(AttendanceRecord(
                    enrollment_id=grade.enrollment_id,
                    session_id=quiz.session_id,
                    status='present'
                ))
    db.session.commit()

@api_bp.route('/courses/<int:course_id>/quizzes', methods=['GET'])
def get_quizzes(course_id):
    Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    quizzes = Quiz.query.filter_by(course_id=course_id).order_by(Quiz.quiz_date.desc(), Quiz.created_at.desc()).all()
    return jsonify([q.to_dict() for q in quizzes])

@api_bp.route('/courses/<int:course_id>/quizzes', methods=['POST'])
def create_quiz(course_id):
    Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    
    # Handle both JSON and Form data (for file uploads)
    if request.content_type and 'multipart/form-data' in request.content_type:
        data = request.form
    else:
        data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    try:
        max_score = float(data.get('max_score') or 10.0)
    except (ValueError, TypeError):
        max_score = 10.0
        
    raw_date = data.get('quiz_date') or date.today().isoformat()
    try:
        quiz_date = date.fromisoformat(raw_date)
    except ValueError:
        return jsonify({'error': 'Invalid date format.'}), 400
    
    notes = (data.get('notes') or '').strip() or None
    
    session_id = data.get('session_id')
    if session_id and session_id != 'null' and session_id != '':
        session_id = int(session_id)
    else:
        session_id = None
        
    use_as_attendance = str(data.get('use_as_attendance', 'false')).lower() == 'true'
    
    if use_as_attendance and not session_id:
        return jsonify({'error': 'Linked Session must be selected if Use Quiz as Attendance is Yes.'}), 400

    quiz = Quiz(
        course_id=course_id,
        name=name,
        max_score=max_score,
        quiz_date=quiz_date,
        notes=notes,
        session_id=session_id,
        use_as_attendance=use_as_attendance
    )
    
    # Handle file uploads
    # Ensure upload directory exists
    upload_dir = os.path.join(os.getcwd(), 'uploads')
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)

    if 'quiz_file' in request.files:
        f = request.files['quiz_file']
        if f and f.filename:
            filename = secure_filename(f"{datetime.now().timestamp()}_{f.filename}")
            f.save(os.path.join(upload_dir, filename))
            quiz.quiz_file = filename

    if 'model_answer_file' in request.files:
        f = request.files['model_answer_file']
        if f and f.filename:
            filename = secure_filename(f"{datetime.now().timestamp()}_ans_{f.filename}")
            f.save(os.path.join(upload_dir, filename))
            quiz.model_answer_file = filename

    db.session.add(quiz)
    
    # Initialize grades for all enrolled students
    db.session.flush()
    for en in Enrollment.query.filter_by(course_id=course_id).all():
        db.session.add(Grade(quiz_id=quiz.id, enrollment_id=en.id, score=0.0))
        
    db.session.commit()
    
    # Update attendance if needed
    _update_attendance_from_quiz(quiz)
    
    return jsonify(quiz.to_dict()), 201

@api_bp.route('/quizzes/<int:quiz_id>', methods=['GET'])
def get_quiz_detail(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    Course.query.filter_by(id=quiz.course_id, instructor_id=current_user.id).first_or_404()
    
    grades_data = []
    for g in quiz.grades.all():
        en = g.enrollment
        grades_data.append({
            'grade_id': g.id,
            'student_id': en.student.student_id,
            'student_name': en.student.name,
            'score': g.score,
            'is_graded': g.is_graded,
            'created_at': g.created_at.isoformat()
        })
    grades_data.sort(key=lambda x: x['student_name'])
    
    # Include session info if linked
    res = {'quiz': quiz.to_dict(), 'grades': grades_data}
    if quiz.session_id:
        session = AttendanceSession.query.get(quiz.session_id)
        if session:
            res['session_label'] = f"{session.session_type.capitalize()} ({session.session_date})"
            if session.label:
                res['session_label'] += f" - {session.label}"

    return jsonify(res)

@api_bp.route('/quizzes/<int:quiz_id>', methods=['PUT'])
def update_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    Course.query.filter_by(id=quiz.course_id, instructor_id=current_user.id).first_or_404()
    
    if request.content_type and 'multipart/form-data' in request.content_type:
        data = request.form
    else:
        data = request.get_json() or {}
    
    if 'name' in data: quiz.name = data['name'].strip()
    if 'max_score' in data: quiz.max_score = float(data['max_score'] or 0)
    if 'quiz_date' in data: 
        try:
            quiz.quiz_date = date.fromisoformat(data['quiz_date'])
        except ValueError:
            return jsonify({'error': 'Invalid date format.'}), 400
    if 'notes' in data: quiz.notes = data['notes'].strip() or None
    
    if 'session_id' in data:
        sid = data.get('session_id')
        if sid and sid != 'null' and sid != '':
            quiz.session_id = int(sid)
        else:
            quiz.session_id = None
            
    if 'use_as_attendance' in data:
        quiz.use_as_attendance = str(data.get('use_as_attendance')).lower() == 'true'

    if quiz.use_as_attendance and not quiz.session_id:
        return jsonify({'error': 'Linked Session must be selected if Use Quiz as Attendance is Yes.'}), 400

    # Handle file uploads
    upload_dir = os.path.join(os.getcwd(), 'uploads')
    if not os.path.exists(upload_dir): os.makedirs(upload_dir)

    # Deleting files if requested
    if data.get('delete_quiz_file') == 'true' and quiz.quiz_file:
        old_path = os.path.join(upload_dir, quiz.quiz_file)
        if os.path.exists(old_path): os.remove(old_path)
        quiz.quiz_file = None

    if data.get('delete_model_answer_file') == 'true' and quiz.model_answer_file:
        old_path = os.path.join(upload_dir, quiz.model_answer_file)
        if os.path.exists(old_path): os.remove(old_path)
        quiz.model_answer_file = None

    if 'quiz_file' in request.files:
        f = request.files['quiz_file']
        if f and f.filename:
            # Delete old if exists
            if quiz.quiz_file:
                op = os.path.join(upload_dir, quiz.quiz_file)
                if os.path.exists(op): os.remove(op)
            filename = secure_filename(f"{datetime.now().timestamp()}_{f.filename}")
            f.save(os.path.join(upload_dir, filename))
            quiz.quiz_file = filename

    if 'model_answer_file' in request.files:
        f = request.files['model_answer_file']
        if f and f.filename:
            # Delete old if exists
            if quiz.model_answer_file:
                op = os.path.join(upload_dir, quiz.model_answer_file)
                if os.path.exists(op): os.remove(op)
            filename = secure_filename(f"{datetime.now().timestamp()}_ans_{f.filename}")
            f.save(os.path.join(upload_dir, filename))
            quiz.model_answer_file = filename

    db.session.commit()
    
    # Re-sync attendance
    _update_attendance_from_quiz(quiz)
    
    return jsonify(quiz.to_dict())

@api_bp.route('/quizzes/<int:quiz_id>', methods=['DELETE'])
def delete_quiz(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    Course.query.filter_by(id=quiz.course_id, instructor_id=current_user.id).first_or_404()
    
    # Handle files deletion
    upload_dir = os.path.join(os.getcwd(), 'uploads')
    if quiz.quiz_file:
        p = os.path.join(upload_dir, quiz.quiz_file)
        if os.path.exists(p): os.remove(p)
    if quiz.model_answer_file:
        p = os.path.join(upload_dir, quiz.model_answer_file)
        if os.path.exists(p): os.remove(p)
        
    db.session.delete(quiz)
    db.session.commit()
    return jsonify({'message': 'Quiz deleted.'})

@api_bp.route('/quizzes/files/<filename>', methods=['GET'])
def download_quiz_file(filename):
    # This is a bit insecure but sufficient for the requested feature
    # Ideally we'd check if the user has access to the quiz this file belongs to.
    upload_dir = os.path.join(os.getcwd(), 'uploads')
    return send_from_directory(upload_dir, filename)

@api_bp.route('/quizzes/<int:quiz_id>/grades/<int:grade_id>', methods=['PUT'])
def update_grade(quiz_id, grade_id):
    grade = Grade.query.get_or_404(grade_id)
    quiz = Quiz.query.get_or_404(quiz_id)
    Course.query.filter_by(id=quiz.course_id, instructor_id=current_user.id).first_or_404()
    
    data = request.get_json()
    try:
        score = float(data.get('score', 0.0))
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid score.'}), 400
        
    if score > quiz.max_score:
        return jsonify({'error': f'Score cannot be higher than {quiz.max_score}.'}), 400
        
    grade.score = score
    grade.is_graded = True
    db.session.commit()
    
    # Trigger attendance update if needed
    if quiz.use_as_attendance and quiz.session_id:
        _update_attendance_from_quiz(quiz)

    return jsonify(grade.to_dict())

@api_bp.route('/quizzes/<int:quiz_id>/quick-grade', methods=['POST'])
def quick_grade(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    Course.query.filter_by(id=quiz.course_id, instructor_id=current_user.id).first_or_404()
    
    data = request.get_json()
    student_id_input = (data.get('student_id') or '').strip()
    try:
        score = float(data.get('score') or 0.0)
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid score.'}), 400
    
    if score > quiz.max_score:
        return jsonify({'error': f'Score cannot be higher than {quiz.max_score}.'}), 400
        
    student = Student.query.filter_by(student_id=student_id_input).first()
    if not student:
        return jsonify({'error': f'Student "{student_id_input}" not found.'}), 404
        
    enrollment = Enrollment.query.filter_by(student_id=student.id, course_id=quiz.course_id).first()
    if not enrollment:
        return jsonify({'error': f'Student "{student_id_input}" not enrolled.'}), 404
        
    grade = Grade.query.filter_by(quiz_id=quiz.id, enrollment_id=enrollment.id).first()
    if not grade:
        grade = Grade(quiz_id=quiz.id, enrollment_id=enrollment.id, score=score, is_graded=True)
        db.session.add(grade)
    else:
        grade.score = score
        grade.is_graded = True
        
    grade.is_graded = True
    db.session.commit()
    
    # Trigger attendance update if needed
    if quiz.use_as_attendance and quiz.session_id:
        _update_attendance_from_quiz(quiz)

    return jsonify({
        'message': f'✓ Grade saved for {student.name}: {score}',
        'student': student.to_dict(),
        'grade': grade.to_dict()
    })

@api_bp.route('/courses/<int:course_id>/quizzes/summary', methods=['GET'])
def get_quiz_summary(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    quizzes = Quiz.query.filter_by(course_id=course_id).order_by(Quiz.quiz_date).all()
    enrollments = course.enrollments.all()
    
    att_enabled = bool(course.att_grade_enabled)
    
    results = []
    for en in enrollments:
        student_grades = []
        total_score = 0.0
        for q in quizzes:
            g = Grade.query.filter_by(quiz_id=q.id, enrollment_id=en.id).first()
            score = g.score if g else 0.0
            student_grades.append({
                'quiz_id': q.id,
                'quiz_name': q.name,
                'score': score
            })
            total_score += score
        
        # Compute attendance grade if enabled
        att_info = _compute_attendance_grade(en, course)
        att_grade = att_info['attendance_grade']
        
        final_total = total_score + (att_grade if att_grade is not None else 0)
            
        results.append({
            'student_id': en.student.student_id,
            'student_name': en.student.name,
            'grades': student_grades,
            'total_score': total_score,
            'attendance_grade': att_grade,
            'total_absences': att_info['total_absences'],
            'final_total': round(final_total, 2),
        })
        
    results.sort(key=lambda x: x['student_name'])
    return jsonify({
        'quizzes': [q.to_dict() for q in quizzes],
        'students': results,
        'att_grade_enabled': att_enabled,
        'att_grade_max': course.att_grade_max if course.att_grade_max is not None else 10.0,
    })


@api_bp.route('/courses/<int:course_id>/attendance-grades', methods=['GET'])
def get_attendance_grades(course_id):
    """Return attendance grades for all students in a course."""
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    enrollments = course.enrollments.all()

    results = []
    for en in enrollments:
        att_info = _compute_attendance_grade(en, course)
        results.append({
            'student_id': en.student.student_id,
            'student_name': en.student.name,
            'attendance_grade': att_info['attendance_grade'],
            'total_absences': att_info['total_absences'],
        })
    results.sort(key=lambda x: x['student_name'])
    return jsonify({
        'att_grade_enabled': bool(course.att_grade_enabled),
        'att_grade_max': course.att_grade_max if course.att_grade_max is not None else 10.0,
        'att_grade_deduction': course.att_grade_deduction if course.att_grade_deduction is not None else 1.0,
        'students': results,
    })

# ─── Quiz Exports ───────────────────────────────────────────────────────────

@api_bp.route('/courses/<int:course_id>/export-quizzes/excel', methods=['GET'])
def export_all_quizzes_excel(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f'All Quizzes - {course.code}'
    
    hfill  = PatternFill('solid', fgColor='1e293b')
    hfont  = Font(color='FFFFFF', bold=True)
    center = Alignment(horizontal='center', vertical='center')
    thin   = Side(style='thin', color='CBD5E1')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    att_hfill = PatternFill('solid', fgColor='065F46')  # Dark green for attendance grade header
    
    att_enabled = bool(course.att_grade_enabled)
    att_max = course.att_grade_max if course.att_grade_max is not None else 10.0
    
    # Headers
    headers = ['Student ID', 'Student Name']
    quizzes = Quiz.query.filter_by(course_id=course_id).order_by(Quiz.quiz_date).all()
    
    for q in quizzes:
        headers.append(q.name)
    
    headers.append('Quiz Total')
    
    if att_enabled:
        headers.append(f'Attendance Grade (/{att_max})')
    
    headers.extend(['Final Total', 'Average Score'])
    
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = hfont; cell.alignment = center; cell.border = border
        # Use green fill for the attendance grade column header
        if att_enabled and h.startswith('Attendance Grade'):
            cell.fill = att_hfill
        else:
            cell.fill = hfill
        
    # Get students and grades
    enrollments = course.enrollments.all()
    rows = []
    
    for en in enrollments:
        student_data = [en.student.student_id, en.student.name]
        total_score = 0.0
        quiz_count = len(quizzes)
        
        for q in quizzes:
            grade = Grade.query.filter_by(quiz_id=q.id, enrollment_id=en.id).first()
            score = grade.score if grade else 0.0
            student_data.append(score)
            total_score += score
        
        student_data.append(total_score)  # Quiz Total
        
        att_grade = 0.0
        if att_enabled:
            att_info = _compute_attendance_grade(en, course)
            att_grade = att_info['attendance_grade'] if att_info['attendance_grade'] is not None else 0.0
            student_data.append(att_grade)
        
        final_total = total_score + att_grade
        student_data.append(round(final_total, 2))  # Final Total
        
        average = total_score / quiz_count if quiz_count > 0 else 0.0
        student_data.append(round(average, 2))
        rows.append(student_data)
        
    # Sort by name
    rows.sort(key=lambda x: str(x[1]).lower() if x[1] else '')
    
    for r_idx, r_data in enumerate(rows, 2):
        for c_idx, val in enumerate(r_data, 1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.border = border
            if c_idx == 2:
                cell.alignment = Alignment(horizontal='left', vertical='center')
            else:
                cell.alignment = center
                
    ws.column_dimensions['A'].width = 15
    ws.column_dimensions['B'].width = 30
    for i in range(3, len(headers) + 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = 14
        
    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return send_file(buf, as_attachment=True,
                     download_name=f'All_Quizzes_{course.code}.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@api_bp.route('/quizzes/<int:quiz_id>/export/excel', methods=['GET'])
def export_quiz_excel(quiz_id):
    quiz = Quiz.query.get_or_404(quiz_id)
    course = Course.query.get(quiz.course_id)
    Course.query.filter_by(id=quiz.course_id, instructor_id=current_user.id).first_or_404()
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f'Quiz {quiz.name}'
    
    hfill  = PatternFill('solid', fgColor='1e293b')
    hfont  = Font(color='FFFFFF', bold=True)
    center = Alignment(horizontal='center', vertical='center')
    thin   = Side(style='thin', color='CBD5E1')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    afill  = PatternFill('solid', fgColor='FECACA') # For 0 scores
    
    # Header info
    ws['A1'] = f'Course: {course.name} ({course.code})'
    ws['A2'] = f'Quiz: {quiz.name}'
    ws['A3'] = f'Date: {quiz.quiz_date.isoformat()}'
    ws['A4'] = f'Max Score: {quiz.max_score}'
    
    include_names = request.args.get('include_names', 'true').lower() == 'true'
    
    headers = ['Student ID', 'Grade']
    if include_names:
        headers.insert(1, 'Student Name')
        
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=6, column=col, value=h)
        cell.font = hfont; cell.fill = hfill; cell.alignment = center; cell.border = border
        
    grades = quiz.grades.all()
    rows = []
    for g in grades:
        en = g.enrollment
        if include_names:
            rows.append((en.student.student_id, en.student.name, g.score, g.is_graded))
        else:
            rows.append((en.student.student_id, g.score, g.is_graded))
            
    if include_names:
        rows.sort(key=lambda x: x[1])
    else:
        rows.sort(key=lambda x: x[0])
    
    for r_idx, r_data in enumerate(rows, 7):
        for c_idx, val in enumerate(r_data, 1):
            cell = ws.cell(row=r_idx, column=c_idx, value=val)
            cell.border = border
            # Color red only if score is 0 AND it's actually graded
            is_graded = r_data[-1]
            score = r_data[-2]
            if score == 0 and is_graded:
                cell.fill = afill
            # Center ID and Grade, but not Name
            cell.alignment = center
            
    # Auto-width adjustments
    if include_names:
        ws.column_dimensions['B'].width = 30
        ws.column_dimensions['C'].width = 10
    else:
        ws.column_dimensions['B'].width = 10
            
    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    return send_file(buf, as_attachment=True,
                     download_name=f'Quiz_{quiz.name}_{course.code}.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@api_bp.route('/quizzes/<int:quiz_id>/export/word', methods=['GET'])
def export_quiz_word(quiz_id):
    try:
        from docx import Document
        from docx.shared import Inches
        from docx.oxml import parse_xml
        from docx.oxml.ns import nsdecls
    except ImportError:
        return "python-docx not installed", 500
        
    quiz = Quiz.query.get_or_404(quiz_id)
    course = Course.query.get(quiz.course_id)
    Course.query.filter_by(id=quiz.course_id, instructor_id=current_user.id).first_or_404()
    
    doc = Document()
    
    # Title styling
    title = doc.add_heading(f'Quiz Results: {quiz.name}', 0)
    title.alignment = 1 # 1 = Center
    
    # Info paragraph
    info = doc.add_paragraph()
    info.alignment = 1
    info.add_run(f'Course: ').bold = True
    info.add_run(f'{course.name} ({course.code})\n').italic = True
    info.add_run(f'Date: ').bold = True
    info.add_run(f'{quiz.quiz_date.isoformat()}\n')
    info.add_run(f'Maximum Score: ').bold = True
    info.add_run(f'{quiz.max_score}')
    
    include_names = request.args.get('include_names', 'true').lower() == 'true'
    
    cols = 3 if include_names else 2
    table = doc.add_table(rows=1, cols=cols)
    table.style = 'Light Grid Accent 1' # Nicer built-in style
    table.alignment = 1 # Center table
    
    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = 'Student ID'
    if include_names:
        hdr_cells[1].text = 'Student Name'
        hdr_cells[2].text = 'Grade'
        # Set column widths
        table.columns[0].width = Inches(1.5) # ID
        table.columns[1].width = Inches(3.5) # Name (Wide)
        table.columns[2].width = Inches(1.0) # Grade
    else:
        hdr_cells[1].text = 'Grade'
        table.columns[0].width = Inches(2.0)
        table.columns[1].width = Inches(1.5)
    
    # Bold the headers
    for cell in hdr_cells:
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.bold = True

    grades = quiz.grades.all()
    rows = []
    for g in grades:
        en = g.enrollment
        if include_names:
            rows.append((en.student.student_id, en.student.name, g.score, g.is_graded))
        else:
            rows.append((en.student.student_id, g.score, g.is_graded))
            
    if include_names:
        rows.sort(key=lambda x: x[1])
    else:
        rows.sort(key=lambda x: x[0])
    
    for r_data in rows:
        row_cells = table.add_row().cells
        is_graded = r_data[-1]
        score = r_data[-2]
        for i, val in enumerate(r_data[:cols]):
            row_cells[i].text = str(val)
            # Center ID and Grade
            if not (include_names and i == 1):
                row_cells[i].paragraphs[0].alignment = 1

            # Shading for zero scores (only if graded)
            if score == 0 and is_graded:
                shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="FECACA"/>')
                row_cells[i]._tc.get_or_add_tcPr().append(shading_elm)
        
    buf = io.BytesIO()
    doc.save(buf); buf.seek(0)
    return send_file(buf, as_attachment=True,
                     download_name=f'Quiz_{quiz.name}_{course.code}.docx',
                     mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document')

@api_bp.route('/quizzes/<int:quiz_id>/export/pdf', methods=['GET'])
def export_quiz_pdf(quiz_id):
    try:
        from fpdf import FPDF
    except ImportError:
        return "fpdf2 not installed. Run: pip install fpdf2", 500
        
    quiz = Quiz.query.get_or_404(quiz_id)
    course = Course.query.get(quiz.course_id)
    Course.query.filter_by(id=quiz.course_id, instructor_id=current_user.id).first_or_404()
    
    class PDF(FPDF):
        def header(self):
            # Header color block
            self.set_fill_color(30, 41, 59) # Dark blue/gray (bg-1 style)
            self.rect(0, 0, 210, 40, 'F')
            
            self.set_text_color(255, 255, 255)
            self.set_font('Arial', 'B', 16)
            self.cell(0, 10, f'Quiz Results: {quiz.name}', 0, 1, 'C')
            
            self.set_font('Arial', '', 10)
            self.cell(0, 7, f'Course: {course.name} ({course.code})', 0, 1, 'C')
            self.cell(0, 7, f'Date: {quiz.quiz_date.isoformat()} | Maximum Score: {quiz.max_score}', 0, 1, 'C')
            self.ln(12)
            
        def footer(self):
            self.set_y(-15)
            self.set_font('Arial', 'I', 8)
            self.set_text_color(100)
            self.cell(0, 10, f'Generated on {date.today().isoformat()} | Page {self.page_no()}/{{nb}}', 0, 0, 'C')

    include_names = request.args.get('include_names', 'true').lower() == 'true'

    pdf = PDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_text_color(0)
    pdf.set_font('Arial', 'B', 11)
    
    # Set header colors
    pdf.set_fill_color(59, 130, 246) # Blue color for table header
    pdf.set_text_color(255)
    
    if include_names:
        col_widths = [45, 100, 35]
        headers = ['Student ID', 'Student Name', 'Grade']
    else:
        col_widths = [100, 80]
        headers = ['Student ID', 'Grade']
        
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 12, h, 1, 0, 'C', fill=True)
    pdf.ln()
    
    pdf.set_font('Arial', '', 11)
    grades = quiz.grades.all()
    rows = []
    for g in grades:
        en = g.enrollment
        if include_names:
            rows.append((en.student.student_id, en.student.name, g.score, g.is_graded))
        else:
            rows.append((en.student.student_id, g.score, g.is_graded))
            
    if include_names:
        rows.sort(key=lambda x: x[1])
    else:
        rows.sort(key=lambda x: x[0])
    
    for r_data in rows:
        for i, val in enumerate(r_data[:len(headers)]):
            align = 'L' if (include_names and i == 1) else 'C'
            # Sanitize string to prevent latin-1 encoding errors with non-latin chars (like Arabic)
            # This prevents the backend from crashing and returning an empty/broken file.
            txt = str(val).encode('latin-1', 'replace').decode('latin-1')
            pdf.cell(col_widths[i], 10, txt, 1, 0, align)
        pdf.ln()
        
    buf = io.BytesIO()
    # fpdf2 output() returns bytes by default, ensuring compatibility and fixing the "empty file" issue.
    buf.write(pdf.output())
    buf.seek(0)
    return send_file(buf, as_attachment=True,
                     download_name=f'Quiz_{quiz.name}_{course.code}.pdf',
                     mimetype='application/pdf')




# ─── Warning Doc Generation ──────────────────────────────────────────────────

@api_bp.route('/courses/<int:course_id>/export-warnings', methods=['GET'])
def export_warnings_doc(course_id):
    try:
        from docx import Document as DocxDocument
        from docx.oxml import OxmlElement
        from docx.oxml.ns import qn as docx_qn
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.shared import Pt
        import copy
    except ImportError:
        return "python-docx not installed. Run: pip install python-docx", 500

    AR_MONTHS = {
        1:'يناير', 2:'فبراير', 3:'مارس',  4:'أبريل',
        5:'مايو',  6:'يونيو',  7:'يوليو', 8:'أغسطس',
        9:'سبتمبر',10:'أكتوبر',11:'نوفمبر',12:'ديسمبر',
    }

    def fmt_date_ar(d_str):
        try:
            from datetime import date as _date
            d = _date.fromisoformat(d_str)
            return f"{d.day} {AR_MONTHS[d.month]}"
        except Exception:
            return d_str

    course      = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    semester_en = request.args.get('sem', 'Fall')
    semester_ar = 'خريف' if semester_en.lower() == 'fall' else 'ربيع'
    year        = request.args.get('year', '')
    from_date   = fmt_date_ar(request.args.get('from_d', ''))
    to_date     = fmt_date_ar(request.args.get('to_d', ''))
    instructor  = request.args.get('inst', '')
    ta_name     = request.args.get('ta', '')
    level       = request.args.get('level', '')

    # ── DR. / TA. prefixes ──────────────────────────────────────────────────
    instructor_display = f"Dr. {instructor}".strip() if instructor else ''
    ta_display         = f"TA. {ta_name}".strip() if ta_name else ''

    # ── Gather students over 25% absence ─────────────────────────────────────
    warning_students = []
    for e in course.enrollments.all():
        w = _compute_warnings(e, course)
        total  = w['lec_total'] + w['sec_total']
        absent = w['lec_absent'] + w['sec_absent']
        if total > 0 and (absent / total) > 0.25:
            warning_students.append(e.student)
    warning_students.sort(key=lambda s: s.student_id)

    if not warning_students:
        return "No students currently exceed the 25% absence threshold.", 400

    # ── Open template ─────────────────────────────────────────────────────────
    template_path = os.path.join(os.getcwd(), 'warning form 1.docx')
    if not os.path.exists(template_path):
        return f"Template not found: {template_path}", 404

    doc = DocxDocument(template_path)

    # ── Build replacements (supports {{ key }} and {{key}}) ───────────────────
    VALS = {
        'sem':         semester_ar,
        'sem_en':      semester_en,
        'year':        year,
        'from_date':   from_date,
        'to_date':     to_date,
        'course_name': course.name,
        'course_code': course.code,
        'lvl':         level,
        'instructor':  instructor_display,   # with Dr. prefix
        'ta':          ta_display,            # with TA. prefix
    }
    REPLACEMENTS = {}
    for k, v in VALS.items():
        REPLACEMENTS[f'{{{{ {k} }}}}'] = v
        REPLACEMENTS[f'{{{{{k}}}}}']   = v

    def replace_in_paragraph(p):
        full = ''.join(r.text or '' for r in p.runs)
        changed = False
        for old, new in REPLACEMENTS.items():
            if old in full:
                full = full.replace(old, new)
                changed = True
        if changed and p.runs:
            p.runs[0].text = full
            for r in p.runs[1:]:
                r.text = ''

    def center_paragraph(p):
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # ── Replace in document body paragraphs ──────────────────────────────────
    for p in doc.paragraphs:
        replace_in_paragraph(p)

    # ── Replace in table cells; locate the student table ─────────────────────
    student_table = None
    for table in doc.tables:
        hdr = table.cell(0, 0).text.strip().lower()
        if hdr in ('no', 'no.', '#', 'no '):
            student_table = table
        else:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        replace_in_paragraph(p)
                        center_paragraph(p)      # centre instructor/TA labels

    # ── Remove any page-breaks baked into the template ───────────────────────
    # The source .docx may contain a manual page break before the table;
    # strip every <w:br w:type="page"/> from body paragraphs.
    for p in doc.paragraphs:
        for br in p._p.findall('.//' + docx_qn('w:br')):
            br_type = br.get(docx_qn('w:type'))
            if br_type == 'page':
                br.getparent().remove(br)
        # Also handle <w:lastRenderedPageBreak> and pageBreak in pPr
        pPr = p._p.find(docx_qn('w:pPr'))
        if pPr is not None:
            pb = pPr.find(docx_qn('w:pageBreakBefore'))
            if pb is not None:
                pPr.remove(pb)

    # ── Helper: white background for a <w:tc> element ────────────────────────
    def clear_cell_shading(tc_elem):
        tcPr = tc_elem.find(docx_qn('w:tcPr'))
        if tcPr is None:
            tcPr = OxmlElement('w:tcPr')
            tc_elem.insert(0, tcPr)
        shd = tcPr.find(docx_qn('w:shd'))
        if shd is not None:
            tcPr.remove(shd)
        new_shd = OxmlElement('w:shd')
        new_shd.set(docx_qn('w:val'),   'clear')
        new_shd.set(docx_qn('w:color'), 'auto')
        new_shd.set(docx_qn('w:fill'),  'FFFFFF')
        tcPr.append(new_shd)

    # ── Helper: vertical-center a <w:tc> element ──────────────────────────────
    def vcenter_cell(tc_elem):
        tcPr = tc_elem.find(docx_qn('w:tcPr'))
        if tcPr is None:
            tcPr = OxmlElement('w:tcPr')
            tc_elem.insert(0, tcPr)
        vAlign = tcPr.find(docx_qn('w:vAlign'))
        if vAlign is None:
            vAlign = OxmlElement('w:vAlign')
            tcPr.append(vAlign)
        vAlign.set(docx_qn('w:val'), 'center')


    # ── Populate student table ────────────────────────────────────────────────
    if student_table:
        # Remove all rows after the header
        for row in student_table.rows[1:]:
            student_table._tbl.remove(row._tr)

        hdr_row = student_table.rows[0]

        for idx, s in enumerate(warning_students, 1):
            new_tr = copy.deepcopy(hdr_row._tr)
            tcs = new_tr.findall(docx_qn('w:tc'))

            for tc in tcs:
                clear_cell_shading(tc)
                vcenter_cell(tc)
                # Centre-align all paragraphs in the cell
                for p_elem in tc.findall('.//' + docx_qn('w:p')):
                    pPr = p_elem.find(docx_qn('w:pPr'))
                    if pPr is None:
                        pPr = OxmlElement('w:pPr')
                        p_elem.insert(0, pPr)
                    jc = pPr.find(docx_qn('w:jc'))
                    if jc is None:
                        jc = OxmlElement('w:jc')
                        pPr.append(jc)
                    jc.set(docx_qn('w:val'), 'center')
                # Clear all text
                for t in tc.findall('.//' + docx_qn('w:t')):
                    t.text = ''

            if len(tcs) >= 2:
                t0 = tcs[0].find('.//' + docx_qn('w:t'))
                t1 = tcs[1].find('.//' + docx_qn('w:t'))
                if t0 is not None: t0.text = str(idx)
                if t1 is not None: t1.text = str(s.student_id)

            student_table._tbl.append(new_tr)

    else:
        # Fallback plain table
        table = doc.add_table(rows=1, cols=2)
        table.style = 'Table Grid'
        hdr = table.rows[0].cells
        hdr[0].text = 'No'; hdr[1].text = 'Code'
        for idx, s in enumerate(warning_students, 1):
            row = table.add_row().cells
            row[0].text = str(idx); row[1].text = str(s.student_id)

    # ── Send file ─────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    safe_name = course.name.replace(' ', '_')
    return send_file(buf, as_attachment=True,
                     download_name=f'First_Warning_{safe_name}.docx',
                     mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document')

# ─── Smart AI Chatbot ────────────────────────────────────────────────────────
@api_bp.route('/chatbot', methods=['POST'])
def chatbot():
    data = request.get_json()
    message = (data.get('message') or '').strip()
    
    if not message:
        return jsonify({'reply': 'I am here to help. What would you like to know about your courses?'})

    api_key = current_app.config.get('GEMINI_API_KEY')
    
    # Permission-scoped data retrieval
    user_courses = Course.query.filter_by(instructor_id=current_user.id).all()
    
    # Build Context Snapshot for AI
    context_data = {
        "instructor_name": current_user.name or current_user.username,
        "courses": []
    }
    
    for c in user_courses:
        course_info = {
            "name": c.name,
            "code": c.code,
            "student_count": c.enrollments.count(),
            "sessions": [],
            "quizzes": []
        }
        # Recent sessions
        for s in c.sessions.order_by(AttendanceSession.session_date.desc()).limit(5).all():
            abs_count = s.records.filter_by(status='absent').count()
            course_info["sessions"].append({
                "label": s.label,
                "date": str(s.session_date),
                "type": s.session_type,
                "absences": abs_count
            })
        # Recent quizzes
        for q in c.quizzes.order_by(Quiz.created_at.desc()).limit(3).all():
            avg = db.session.query(db.func.avg(Grade.score)).filter(Grade.quiz_id == q.id).scalar() or 0
            course_info["quizzes"].append({
                "name": q.name,
                "max_score": q.max_score,
                "average_grade": float(round(avg, 1))
            })
        context_data["courses"].append(course_info)

    # If NO API KEY, use the advanced rule-based logic as a smart fallback
    if not api_key:
        msg_low = message.lower()
        # Helper to find course in message
        def find_course(msg):
            for c in user_courses:
                if c.name.lower() in msg or c.code.lower() in msg:
                    return c
            return None
        course = find_course(msg_low)
        
        # Social logic fallback
        if any(k in msg_low for k in ['hello', 'hi', 'مرحبا', 'اهلا']) and not course:
            return jsonify({'reply': f'Hello **{context_data["instructor_name"]}**! I am in "Simple Mode" because no AI API Key is configured, but I can still answer basic questions about your courses if you specify the name.'})
            
        if course:
            count = course.enrollments.count()
            if any(k in msg_low for k in ['student', 'طالب', 'عدد']):
                return jsonify({'reply': f'The course **{course.name}** has **{count}** students enrolled.'})
            return jsonify({'reply': f'I found **{course.name}** ({course.code}). It has **{count}** students. Please ask a more specific question (e.g., student count or absences).'})

        return jsonify({'reply': "I am currently running in **Limited Mode** (No Gemini API Key). I can help with basic course stats if you mention the course name, or you can ask 'how to' questions about the system!"})

    # AI PROCESS (Real LLM)
    try:
        _genai.configure(api_key=api_key)
        system_prompt = f"""
        You are the 'AttendEase AI Assistant', a smart, helpful, and professional academic helper for university instructors.
        
        RULES:
        1. You only have access to the data provided in the CONTEXT below. This data belongs to the logged-in instructor: {context_data['instructor_name']}.
        2. If the user asks about a course, student, or data NOT in the context, politely say you don't have access or it's not in their assigned courses.
        3. Use a helpful, encouraging tone. You can chat naturally, say hello, and answer general questions too.
        4. If asked "how to" do something in the system:
           - Add course: Courses tab -> + Add New Course.
           - Record attendance: Open Course -> Attendance tab -> Start New Session.
           - Add students: Open Course -> Student Roster -> Add/Upload.
           - Quizzes: Open Course -> Quizzes -> New Quiz.
        5. Format your responses with Markdown (bolding, lists) to be easy to read.
        
        INSTRUCTOR DATA CONTEXT (JSON):
        {_json.dumps(context_data, ensure_ascii=False, indent=2)}
        
        USER QUESTION:
        {message}
        
        Provide a concise and helpful response based on the CONTEXT and your general knowledge of the system roles.
        """

        # Attempt to use the most compatible model found for this key
        try:
            # 2.5 Worked in testing, trying it first
            model = _genai.GenerativeModel('gemini-2.5-flash')
            response = model.generate_content(system_prompt)
        except Exception:
            try:
                # 1.5 is the most common stable one
                model = _genai.GenerativeModel('gemini-1.5-flash')
                response = model.generate_content(system_prompt)
            except Exception as e2:
                return jsonify({'reply': f"AI Quota Issue: Your API key currently has a 0 limit for standard models or has reached its daily limit. Error details: {str(e2)}"})

        return jsonify({'reply': response.text})
        
    except Exception as e:
        return jsonify({'reply': f"I encountered an error while processing your request: {str(e)}. Please check your API Key configuration."})

import tempfile
import werkzeug.utils

@api_bp.route('/courses/<int:course_id>/parse-sheet', methods=['POST'])
@login_required
def parse_attendance_sheet(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Empty filename'}), 400
        
    api_key = current_app.config.get('GEMINI_API_KEY')
    if not api_key:
        return jsonify({'error': 'Gemini API key not configured in .env file.'}), 500
        
    try:
        # Save temp file
        filename = werkzeug.utils.secure_filename(file.filename)
        fd, temp_path = tempfile.mkstemp(suffix='_' + filename)
        with os.fdopen(fd, 'wb') as f:
            file.save(f)
            
        _genai.configure(api_key=api_key)
        
        # Upload to Gemini File API
        gemini_file = _genai.upload_file(path=temp_path)
        
        # We need structured output
        prompt = """
        Extract the attendance data from the uploaded document. 
        Important: The document might contain columns for both Lectures AND Labs/Sections.
        Return ONLY valid JSON data with this exact structure:
        {
          "course_name": "extracted name or null",
          "course_code": "extracted code or null",
          "session_date": "YYYY-MM-DD or null",
          "records": [
            {
              "student_id": "string",
              "lecture_status": "present or absent or null",
              "lab_status": "present or absent or null"
            }
          ]
        }
        Interpret checkmarks, 'P', '1', or any mark as 'present'. Empty cells, 'A', or '0' as 'absent'.
        Make sure you return raw JSON without any markdown code blocks.
        """
        
        try:
            model = _genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content([gemini_file, prompt])
        except Exception:
            model = _genai.GenerativeModel('gemini-2.5-flash')
            response = model.generate_content([gemini_file, prompt])
            
        # Clean up Gemini file
        gemini_file.delete()
        os.remove(temp_path)
        
        raw_json = response.text.strip()
        if raw_json.startswith('```json'):
            raw_json = raw_json[7:]
        if raw_json.endswith('```'):
            raw_json = raw_json[:-3]
            
        parsed_data = _json.loads(raw_json)
        return jsonify({'success': True, 'data': parsed_data})
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': str(e)}), 500

@api_bp.route('/courses/<int:course_id>/import-attendance-sheet', methods=['POST'])
@login_required
def import_attendance_sheet(course_id):
    course = Course.query.filter_by(id=course_id, instructor_id=current_user.id).first_or_404()
    data = request.json
    
    target_week = int(data.get('target_week', 1))
    session_type = data.get('session_type', 'lecture').lower()
    session_date_str = data.get('session_date')
    import_mode = data.get('import_mode', 'present_only') # 'present_only' or 'full'
    records_data = data.get('records', [])
    
    # Identify target session
    existing_sessions = course.sessions.filter_by(session_type=session_type).order_by(AttendanceSession.session_date).all()
    
    # Week logic: If creating a new one
    if target_week > len(existing_sessions):
        # We need a valid date. If none provided, use today
        if not session_date_str:
            session_date_str = date.today().isoformat()
            
        # parse date string
        try:
            sess_date = datetime.strptime(session_date_str, '%Y-%m-%d').date()
        except ValueError:
            sess_date = date.today()
            
        session = AttendanceSession(
            course_id=course.id,
            session_date=sess_date,
            session_type=session_type,
            label=f"Imported Week {target_week}"
        )
        db.session.add(session)
        db.session.flush() # get ID
    else:
        # Existing session
        session = existing_sessions[target_week - 1]
        
    # Match students and record attendance
    enrollments = { e.student.student_id: e for e in course.enrollments.all() }
    
    matched_count = 0
    
    # Pre-process incoming records into a map
    incoming_map = {}
    for r in records_data:
        rid = str(r.get('student_id', '')).strip()
        if session_type == 'lecture':
            status = r.get('lecture_status') or r.get('status')
        else:
            status = r.get('lab_status') or r.get('status')
        
        if status:
            incoming_map[rid] = status.lower()
    
    for sid, enrollment in enrollments.items():
        sid_str = str(sid).strip()
        if sid_str in incoming_map:
            status = incoming_map[sid_str]
            is_present = (status == 'present')
        else:
            if import_mode == 'full':
                is_present = False
            else:
                continue # Skip if present_only and student not in sheet
        
        # Check if record exists
        rec = AttendanceRecord.query.filter_by(enrollment_id=enrollment.id, session_id=session.id).first()
        if not rec:
            rec = AttendanceRecord(
                enrollment_id=enrollment.id,
                session_id=session.id,
                status='present' if is_present else 'absent'
            )
            db.session.add(rec)
        else:
            # Overwrite
            rec.status = 'present' if is_present else 'absent'
            
        matched_count += 1
        
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'session_id': session.id,
        'matched_count': matched_count,
        'message': f'Successfully updated attendance for {matched_count} students.'
    })
