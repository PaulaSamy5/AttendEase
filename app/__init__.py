from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_login import LoginManager
from flask_bcrypt import Bcrypt
import os

db = SQLAlchemy()
login_manager = LoginManager()
bcrypt = Bcrypt()

def create_app():
    app = Flask(__name__, static_folder='../frontend', static_url_path='')

    base_dir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(base_dir, "attendance.db")}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'attendance-secret-key-2024'
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

    # ── Load .env file if it exists (simple parser, no extra dependency) ──────
    _env_path = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), '.env')
    _env_vars = {}
    if os.path.exists(_env_path):
        with open(_env_path) as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith('#') and '=' in _line:
                    _k, _, _v = _line.partition('=')
                    _env_vars[_k.strip()] = _v.strip().strip('"').strip("'")

    def _cfg(key, default=''):
        return _env_vars.get(key) or os.environ.get(key, default)

    # Email Configurations
    app.config['MAIL_SERVER']   = _cfg('MAIL_SERVER',   'smtp.gmail.com')
    app.config['MAIL_PORT']     = int(_cfg('MAIL_PORT', '587'))
    app.config['MAIL_USE_TLS']  = True
    app.config['MAIL_USERNAME'] = _cfg('MAIL_USERNAME', '')
    app.config['MAIL_PASSWORD'] = _cfg('MAIL_PASSWORD', '')
    app.config['GEMINI_API_KEY'] = _cfg('GEMINI_API_KEY', '')

    CORS(app)
    db.init_app(app)
    login_manager.init_app(app)
    bcrypt.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        from app.models import User
        return User.query.get(int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        return {"error": "Unauthorized. Please log in."}, 401

    from app.routes import main_bp, api_bp
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')

    with app.app_context():
        # Enforce foreign keys for SQLite
        if "sqlite" in app.config['SQLALCHEMY_DATABASE_URI']:
            from sqlalchemy import event
            @event.listens_for(db.engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

        db.create_all()
        _migrate(app)

    return app


def _migrate(app):
    """Safely add new columns without losing existing data."""
    from sqlalchemy import text, inspect
    with app.app_context():
        inspector = inspect(db.engine)

        existing = {c['name'] for c in inspector.get_columns('courses')}
        new_cols = {
            'warn1_lec':   'INTEGER DEFAULT 3',
            'warn2_lec':   'INTEGER DEFAULT 5',
            'deprive_lec': 'INTEGER DEFAULT 7',
            'warn1_sec':   'INTEGER DEFAULT 2',
            'warn2_sec':   'INTEGER DEFAULT 3',
            'deprive_sec': 'INTEGER DEFAULT 4',
            'lec_weight':  'REAL DEFAULT 1.0',
            'sec_weight':  'REAL DEFAULT 1.0',
        }
        for col, col_def in new_cols.items():
            if col not in existing:
                db.session.execute(text(f'ALTER TABLE courses ADD COLUMN {col} {col_def}'))

        if 'instructor_id' not in existing:
            db.session.execute(text('ALTER TABLE courses ADD COLUMN instructor_id INTEGER'))
            # assign all existing courses to user id 1
            db.session.execute(text('UPDATE courses SET instructor_id = 1 WHERE instructor_id IS NULL'))

        # ── users table ──────────────────────────────────────────────────────
        existing_users = {c['name'] for c in inspector.get_columns('users')}
        if 'email' not in existing_users:
            db.session.execute(text('ALTER TABLE users ADD COLUMN email VARCHAR(120)'))
        if 'reset_token' not in existing_users:
            db.session.execute(text('ALTER TABLE users ADD COLUMN reset_token VARCHAR(100)'))
        if 'reset_token_expiry' not in existing_users:
            db.session.execute(text('ALTER TABLE users ADD COLUMN reset_token_expiry DATETIME'))
        if 'is_verified' not in existing_users:
            db.session.execute(text('ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0'))
        if 'verification_code' not in existing_users:
            db.session.execute(text('ALTER TABLE users ADD COLUMN verification_code VARCHAR(10)'))
        if 'verification_expiry' not in existing_users:
            db.session.execute(text('ALTER TABLE users ADD COLUMN verification_expiry DATETIME'))
        if 'is_approved' not in existing_users:
            db.session.execute(text('ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT 0'))
        if 'is_blocked' not in existing_users:
            db.session.execute(text('ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT 0'))
        if 'ui_mode' not in existing_users:
            db.session.execute(text("ALTER TABLE users ADD COLUMN ui_mode VARCHAR(20) DEFAULT 'standard'"))

        # Mark all existing admin users as verified + approved
        db.session.execute(text(
            'UPDATE users SET is_verified=1, is_approved=1 WHERE is_admin=1'
        ))

        from app.models import User
        if User.query.count() == 0:
            admin = User(
                username='admin', name='Admin', is_admin=True,
                is_verified=True, is_approved=True,
                password_hash=bcrypt.generate_password_hash('123456').decode('utf-8')
            )
            db.session.add(admin)

        # ── attendance_sessions table ────────────────────────────────────────
        existing_sess = {c['name'] for c in inspector.get_columns('attendance_sessions')}
        if 'session_type' not in existing_sess:
            db.session.execute(text(
                "ALTER TABLE attendance_sessions ADD COLUMN session_type VARCHAR(10) DEFAULT 'lecture'"
            ))
        if 'cancelled' not in existing_sess:
            db.session.execute(text(
                "ALTER TABLE attendance_sessions ADD COLUMN cancelled BOOLEAN DEFAULT 0"
            ))
            
        # ── attendance grade settings on courses ──────────────────────────────
        att_grade_cols = {
            'att_grade_enabled':   'BOOLEAN DEFAULT 0',
            'att_grade_max':       'REAL DEFAULT 10.0',
            'att_grade_deduction': 'REAL DEFAULT 1.0',
        }
        for col, col_def in att_grade_cols.items():
            if col not in existing:
                db.session.execute(text(f'ALTER TABLE courses ADD COLUMN {col} {col_def}'))

        # ── grades table ─────────────────────────────────────────────────────
        existing_grades = {c['name'] for c in inspector.get_columns('grades')}
        if 'is_graded' not in existing_grades:
            db.session.execute(text('ALTER TABLE grades ADD COLUMN is_graded BOOLEAN DEFAULT 0'))
            # Mark all existing non-zero grades as graded
            db.session.execute(text('UPDATE grades SET is_graded = 1 WHERE score > 0'))

        db.session.commit()
