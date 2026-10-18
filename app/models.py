from app import db
from datetime import datetime
from flask_login import UserMixin


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(200), nullable=True)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Password reset
    reset_token = db.Column(db.String(100), unique=True, nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)

    # Email verification
    is_verified = db.Column(db.Boolean, default=False)
    verification_code = db.Column(db.String(10), nullable=True)
    verification_expiry = db.Column(db.DateTime, nullable=True)

    # Admin approval
    is_approved = db.Column(db.Boolean, default=False)
    
    # Block feature
    is_blocked = db.Column(db.Boolean, default=False)

    # UI Mode
    ui_mode = db.Column(db.String(20), default='standard') # 'standard' | 'simple'

    courses = db.relationship('Course', backref='instructor', lazy='dynamic', cascade='all, delete-orphan')

    def get_status(self):
        if self.is_blocked:
            return 'blocked'
        if self.is_admin:
            return 'active'
        if not self.is_verified:
            return 'unverified'
        if not self.is_approved:
            return 'pending'
        return 'active'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'name': self.name,
            'is_admin': self.is_admin,
            'is_verified': self.is_verified,
            'is_approved': self.is_approved,
            'is_blocked': self.is_blocked,
            'ui_mode': self.ui_mode,
            'status': self.get_status(),
            'created_at': self.created_at.isoformat()
        }


class Course(db.Model):
    __tablename__ = 'courses'

    id         = db.Column(db.Integer, primary_key=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) # allow null for backwards compat migrating
    name       = db.Column(db.String(200), nullable=False)
    code       = db.Column(db.String(50),  nullable=False) # removed unique=True
    created_at = db.Column(db.DateTime,    default=datetime.utcnow)

    # Absence warning thresholds (lectures)
    warn1_lec   = db.Column(db.Integer, default=3)
    warn2_lec   = db.Column(db.Integer, default=5)
    deprive_lec = db.Column(db.Integer, default=7)

    # Absence warning thresholds (sections)
    warn1_sec   = db.Column(db.Integer, default=2)
    warn2_sec   = db.Column(db.Integer, default=3)
    deprive_sec = db.Column(db.Integer, default=4)

    # Weights: each absence counts as this many points toward the combined total
    lec_weight  = db.Column(db.Float, default=1.0)
    sec_weight  = db.Column(db.Float, default=1.0)

    # Attendance Grade Settings
    att_grade_enabled   = db.Column(db.Boolean, default=False)
    att_grade_max       = db.Column(db.Float,   default=10.0)
    att_grade_deduction = db.Column(db.Float,   default=1.0)

    enrollments = db.relationship('Enrollment',        backref='course', lazy='dynamic', cascade='all, delete-orphan')
    sessions    = db.relationship('AttendanceSession', backref='course', lazy='dynamic', cascade='all, delete-orphan')
    quizzes     = db.relationship('Quiz',              backref='course', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':           self.id,
            'instructor_id': self.instructor_id,
            'name':         self.name,
            'code':         self.code,
            'created_at':   self.created_at.isoformat(),
            'student_count': self.enrollments.count(),
            'quiz_count':    self.quizzes.count(),
            # thresholds
            'warn1_lec':    self.warn1_lec   or 3,
            'warn2_lec':    self.warn2_lec   or 5,
            'deprive_lec':  self.deprive_lec or 7,
            'warn1_sec':    self.warn1_sec   or 2,
            'warn2_sec':    self.warn2_sec   or 3,
            'deprive_sec':  self.deprive_sec or 4,
            # weights
            'lec_weight':   self.lec_weight  if self.lec_weight  is not None else 1.0,
            'sec_weight':   self.sec_weight  if self.sec_weight  is not None else 1.0,
            # attendance grade
            'att_grade_enabled':   bool(self.att_grade_enabled),
            'att_grade_max':       self.att_grade_max  if self.att_grade_max  is not None else 10.0,
            'att_grade_deduction': self.att_grade_deduction if self.att_grade_deduction is not None else 1.0,
        }

class Student(db.Model):
    __tablename__ = 'students'

    id         = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.String(50),  unique=True, nullable=False, index=True)
    name       = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime,    default=datetime.utcnow)

    enrollments = db.relationship('Enrollment', backref='student', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':         self.id,
            'student_id': self.student_id,
            'name':       self.name,
            'created_at': self.created_at.isoformat(),
        }


class Enrollment(db.Model):
    __tablename__ = 'enrollments'

    id         = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    course_id  = db.Column(db.Integer, db.ForeignKey('courses.id'),  nullable=False)
    enrolled_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='unique_enrollment'),)

    attendance_records = db.relationship('AttendanceRecord', backref='enrollment', lazy='dynamic', cascade='all, delete-orphan')
    grades             = db.relationship('Grade',            backref='enrollment', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        total   = self.attendance_records.count()
        present = self.attendance_records.filter_by(status='present').count()
        absent  = total - present
        return {
            'id':      self.id,
            'student': self.student.to_dict(),
            'course':  self.course.to_dict(),
            'total_sessions':   total,
            'present':          present,
            'absent':           absent,
            'attendance_rate':  round((present / total * 100), 1) if total > 0 else 0,
        }


class AttendanceSession(db.Model):
    __tablename__ = 'attendance_sessions'

    id           = db.Column(db.Integer,  primary_key=True)
    course_id    = db.Column(db.Integer,  db.ForeignKey('courses.id'), nullable=False)
    session_date = db.Column(db.Date,     nullable=False)
    session_type = db.Column(db.String(10), nullable=False, default='lecture')   # 'lecture' | 'section' | 'lab'
    label        = db.Column(db.String(200), nullable=True)
    cancelled    = db.Column(db.Boolean,  nullable=False, default=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    records = db.relationship('AttendanceRecord', backref='session', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':           self.id,
            'course_id':    self.course_id,
            'session_date': self.session_date.isoformat(),
            'session_type': self.session_type,
            'label':        self.label,
            'cancelled':    self.cancelled,
            'created_at':   self.created_at.isoformat(),
            'present_count': self.records.filter_by(status='present').count(),
            'total_count':   self.records.count(),
        }


class AttendanceRecord(db.Model):
    __tablename__ = 'attendance_records'

    id            = db.Column(db.Integer, primary_key=True)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    session_id    = db.Column(db.Integer, db.ForeignKey('attendance_sessions.id'), nullable=False)
    status        = db.Column(db.String(10), nullable=False, default='present')  # 'present' | 'absent'
    marked_at     = db.Column(db.DateTime,   default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('enrollment_id', 'session_id', name='unique_record'),)

    def to_dict(self):
        return {
            'id':            self.id,
            'enrollment_id': self.enrollment_id,
            'session_id':    self.session_id,
            'status':        self.status,
            'marked_at':     self.marked_at.isoformat(),
        }


class Quiz(db.Model):
    __tablename__ = 'quizzes'

    id         = db.Column(db.Integer, primary_key=True)
    course_id  = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    name       = db.Column(db.String(200), nullable=False)
    max_score  = db.Column(db.Float, nullable=False, default=10.0)
    quiz_date  = db.Column(db.Date, nullable=False)
    notes      = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    session_id  = db.Column(db.Integer, db.ForeignKey('attendance_sessions.id'), nullable=True)
    use_as_attendance = db.Column(db.Boolean, default=False)
    quiz_file   = db.Column(db.String(255), nullable=True)
    model_answer_file = db.Column(db.String(255), nullable=True)

    grades     = db.relationship('Grade', backref='quiz', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':          self.id,
            'course_id':   self.course_id,
            'session_id':  self.session_id,
            'use_as_attendance': self.use_as_attendance,
            'quiz_file':   self.quiz_file,
            'model_answer_file': self.model_answer_file,
            'name':        self.name,
            'max_score':   self.max_score,
            'quiz_date':   self.quiz_date.isoformat(),
            'notes':       self.notes,
            'created_at':  self.created_at.isoformat(),
            'grade_count': self.grades.count(),
        }


class Grade(db.Model):
    __tablename__ = 'grades'

    id            = db.Column(db.Integer, primary_key=True)
    quiz_id       = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    score         = db.Column(db.Float, nullable=False)
    is_graded     = db.Column(db.Boolean, default=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('quiz_id', 'enrollment_id', name='unique_quiz_grade'),)

    def to_dict(self):
        return {
            'id':            self.id,
            'quiz_id':       self.quiz_id,
            'enrollment_id': self.enrollment_id,
            'score':         self.score,
            'is_graded':     self.is_graded,
            'created_at':    self.created_at.isoformat(),
        }
