/* ─────────────────────────────────────────────────────────────────────────
   AttendEase  — app.js  (v4 — DOMContentLoaded safe)
   ───────────────────────────────────────────────────────────────────────── */

const API = '/api';

/* ══════════════════════════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════════════════════════ */

async function apiFetch(path, opts = {}) {
  const res  = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

function toast(msg, type = 'info') {
  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };
  const icon = icons[type] || 'ℹ';
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<div class="toast-icon-chic">${icon}</div><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('hide');
    el.addEventListener('animationend', () => el.remove());
  }, 3200);
}

function showSuccess(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `<div class="chic-msg-inner">
      <div class="chic-icon">✓</div>
      <div class="chic-text">${msg}</div>
    </div>`;
  el.classList.remove('hidden');
}

const esc = s =>
  String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function rateColor(r) {
  return r >= 75 ? 'var(--green)' : r >= 50 ? 'var(--amber)' : 'var(--red)';
}

function progressHtml(rate) {
  const color = rateColor(rate);
  return `<div class="progress-wrap">
    <div class="progress-bar"><div class="progress-fill" style="width:${rate}%;background:${color}"></div></div>
    <span class="progress-label" style="color:${color}">${rate}%</span>
  </div>`;
}
const WARN_CLASSES = ['warn-ok', 'warn-1', 'warn-2', 'warn-dep'];

function warnBadge(level) {
  const L = translations[currentLang];
  const labels = [L.warn_ok || '✓ OK', L.warn_1 || '⚠ Warn 1', L.warn_2 || '⚠⚠ Warn 2', L.warn_dep || '🚫 Deprived'];
  return `<span class="warn-badge ${WARN_CLASSES[level]}">${labels[level]}</span>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════════════════════════ */

let currentUser = null;
let coursesCache = {};
let currentCourseId   = null;
let quizBackSource    = 'quizzes';
let currentLang       = localStorage.getItem('lang') || 'en';
let currentTheme      = localStorage.getItem('theme') || 'light';
let currentUIMode     = localStorage.getItem('ui-mode') || 'modern';

function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
}
function applyUIMode() {
  document.documentElement.setAttribute('data-ui-mode', currentUIMode);
}

applyTheme();
applyUIMode();

const translations = {
  en: {
    dashboard: "Dashboard",
    courses: "Courses",
    nav_admin: "Admin Settings",
    nav_docs: "Documentation",
    dash_overview: "Overview",
    dash_subtitle: "Your attendance at a glance",
    total_courses: "Total Courses",
    total_students: "Total Students",
    total_sessions: "Total Sessions",
    avg_attendance: "Avg Attendance",
    docs_title: "User Documentation",
    docs_subtitle: "Learn how to use AttendEase effectively",
    profile: "Profile",
    logout: "Log Out",
    welcome: "Welcome",
    login: "Log In",
    username: "Username",
    password: "Password",
    courses_subtitle: "Choose a course to manage sessions and attendance",
    new_course: "New Course",
    table_course: "Course",
    table_code: "Code",
    table_students: "Students",
    table_sessions: "Sessions",
    table_rate: "Rate",
    table_progress: "Progress",
    loading: "Loading...",
    login_btn: "Log In",
    login_subtitle: "Please log in to manage your courses.",
    placeholder_user: "e.g. admin",
    placeholder_pass: "••••••••",
    forgot_link: "Forgot Password?",
    reset_subtitle: "Create a new password",
    send_reset: "Send Reset Link",
    back_to_login: "Back to Login",
    profile_title: "My Profile",
    confirm_password_label: "Confirm Password",
    passwords_dont_match: "Passwords do not match.",
    new_password_label: "New Password",
    placeholder_confirm: "Confirm your password",
    save_changes: "Save Changes",
    // Docs Sections
    doc_courses_title: "Course Management",
    doc_courses_steps: [
      "Navigate to the 'Courses' tab from the sidebar.",
      "Click 'Add Course' to create a new module.",
      "Manage student rosters by uploading Excel files or adding them manually."
    ],
    doc_sessions_title: "Sessions & Attendance",
    doc_sessions_steps: [
      "Open a course and go to the 'Sessions' tab.",
      "Record attendance using 'Quick Mark' by entering Student IDs.",
      "Differentiate between Lectures and Labs (Sections) easily."
    ],
    doc_quizzes_title: "Quizzes & Grading",
    doc_quizzes_steps: [
      "Attach quizzes to specific sessions or create them independently.",
      "Upload quiz files and model answers for student reference.",
      "Enter grades quickly using the optimized table view."
    ],
    doc_reports_title: "Reporting & Exports",
    doc_reports_steps: [
      "Generate Absence Warning documents automatically based on set thresholds.",
      "Export attendance and grade reports to Excel, Word, or PDF.",
      "Monitor student progress with visual charts and indicators."
    ],
    course_breakdown: "Course Breakdown",
    sidebar_profile: "Profile",
    sidebar_logout: "Log Out",
    new_course_btn: "New Course",
    back_to_courses: "Courses",
    tab_sessions: "Sessions",
    tab_students: "Students",
    tab_settings: "Settings",
    tab_quizzes: "Quizzes",
    manage_sessions: "Manage Sessions",
    sessions_subtitle: "Course timeline and paired sessions",
    new_session_btn: "New Session",
    lec_sessions: "Lec Sessions",
    lab_sessions: "Lab / Sec Sessions",
    back_to_sessions: "Back to Sessions",
    quick_attendance: "Quick Attendance",
    quick_attendance_hint: "Type Student ID → press Enter",
    placeholder_id: "Enter Student ID...",
    mark_present: "Mark Present",
    roster_title: "Roster",
    filter_students: "Filter students...",
    mark_all_present: "All Present",
    mark_all_absent: "All Absent",
    export_btn: "Export",
    add_student_btn: "Add Student",
    table_id: "Student ID",
    table_name: "Name",
    table_status: "Today's Status",
    table_lec_abs: "Lec. Abs.",
    table_lab_abs: "Lab/Sec Abs.",
    table_warning: "Warning",
    enrolled_students: "Enrolled Students",
    import_excel: "Import Excel",
    add_enroll: "Add / Enroll",
    search_enrolled: "Search enrolled students...",
    quick_add_student: "Quick Add Student",
    print_warning: "Print 1st Warning",
    import_template_title: "Don't have the file yet?",
    import_template_sub: "Download the ready-made template — fill in your data and upload it back.",
    download_template: "Download Template",
    import_drag_drop: "Drag & drop an .xlsx file here, or",
    browse_file: "Browse File",
    import_hint: "Required columns: Student ID, Student Name",
    enroll_selected: "Enroll Selected",
    new_student: "New Student",
    course_settings: "Course Details",
    course_name_label: "Course Name",
    course_code_label: "Course Code",
    sync_records: "Sync All Records",
    danger_zone: "Danger Zone",
    danger_desc: "Permanently remove this course and all its data.",
    delete_course_btn: "Delete Course",
    absence_thresholds: "Absence Warning Thresholds",
    absence_thresholds_desc: "Number of absences that trigger each warning level.",
    warn_1st: "⚠ 1st Warning",
    warn_2nd: "⚠⚠ 2nd Warning",
    deprivation: "🚫 Deprivation",
    absence_weights: "Absence Weights",
    absence_weights_desc: "Each absence is converted to points — the total is compared against the thresholds above.",
    pts_unit: "pts.",
    pt_abs_unit: "pt / absence",
    save_thresholds: "Save Thresholds",
    manage_quizzes: "Manage Quizzes",
    quizzes_subtitle: "Quiz grades and student evaluation",
    new_quiz_btn: "New Quiz",
    quizzes_overview: "Quizzes Overview (Table)",
    quiz_back: "Back to Quizzes",
    quick_grade_entry: "Quick Grade Entry",
    quick_grade_hint: "Student ID → Grade → Enter",
    save_grade: "Save Grade",
    grade_list: "Grade List",
    export_quiz: "Export Quiz",
    total_score: "Total Score",
    attendance: "Attendance",
    admin_subtitle: "Manage system users and global settings",
    new_instructor: "New Instructor",
    manage_instructors: "Manage Instructors",
    role: "Role",
    table_actions: "Actions",
    full_name: "Full Name",
    placeholder_name: "E.g. Dr. Ahmed",
    email_label: "Email Address",
    placeholder_email: "email@example.com",
    new_password_label: "New Password",
    placeholder_pass_hint: "Leave blank to keep current password",
    cancel: "Cancel",
    add_instructor_title: "Add New Instructor",
    grant_admin: "Grant Administrator Privileges",
    create_user: "Create User",
    course_placeholder: "Data Structures",
    code_placeholder: "CS201",
    create_course: "Create Course",
    new_session_title: "New Attendance Session",
    session_type: "Session Type",
    lecture_ar: "محاضرة",
    section_label: "Section",
    section_ar: "سكشن",
    lab_label: "Lab",
    lab_ar: "لاب",
    placeholder_id_add: "e.g. 20240001",
    placeholder_name_add: "e.g. Ahmed Mohamed Khalil",
    score_formula: "Score = (Lec. absences × {lw}) + (Sec. absences × {sw})",
    no_students_enrolled: "No students enrolled.",
    no_matching_students: "No matching students.",
    quick_quiz_title: "Quick Quiz Integration",
    create_quiz_session: "Create a quiz for this session?",
    quiz_name_placeholder: "e.g. Activity / Quiz",
    max_score: "Max Score",
    att_marker: "Att. Marker?",
    recorded: "Recorded",
    not_recorded: "Not Recorded",
    present: "Present",
    absent: "Absent",
    cancelled: "Cancelled",
    lecture: "Lecture",
    lab: "Lab",
    section: "Section",
    id_label: "ID",
    grade_label: "Grade",
    attendance_label: "Attendance",
    success_label: "Success",
    error_label: "Error",
    graded: "Graded",
    pending: "Not Graded",
    quiz_back: "Back to Quizzes",
    sessions_back: "Back to Sessions",
    quiz_title_label: "Quiz",
    date_label: "Date",
    quiz_max_label: "Max Score",
    student_list_label: "Student List",
    not_linked: "Not linked to session",
    attendance_yes: "Attendance?",
    session_linked: "Linked Session",
    files_label: "Resources & Materials",
    total_label: "Total",
    choose_quiz_file: "Quiz File",
    choose_answer_file: "Model Answer",
    new_quiz_title: "New Quiz",
    edit_quiz_title: "Edit Quiz",
    gen_info: "General Information",
    optional_label: "(optional)",
    notes_label: "Notes",
    att_int: "Attendance Integration",
    att_label_short: "Attendance?",
    delete_user_title: "Delete User",
    delete_session_title: "Delete Session",
    delete_course_title: "Delete Course",
    delete_quiz_title: "Delete Quiz",
    unenroll_title: "Unenroll Student",
    export_options: "Export Options",
    export_desc: "Choose which student information to include in the file:",
    ids_names: "Student IDs & Names",
    ids_names_desc: "Include both identification numbers and full names.",
    ids_only: "Student IDs Only",
    ids_only_desc: "Export only student IDs (names will be hidden).",
    download_now: "Download Now",
    delete_user_confirm: "Are you sure you want to delete user \"{name}\"?\nWarning: All their courses will also be deleted!",
    delete_session_confirm: "Permanently remove this session and all its attendance records?",
    delete_course_confirm: "Delete this entire course and all data? This cannot be undone.",
    delete_quiz_confirm: "Are you sure you want to delete this quiz and all student grades?",
    unenroll_confirm: "Unenroll this student from the course?",
    cancel_btn: "Cancel",
    confirm_btn: "Confirm",
    save_quiz_btn: "Save Quiz",
    placeholder_quiz_name: "e.g. Quiz 1, Midterm Exam…",
    placeholder_quiz_notes: "e.g. Topics covered, difficulty level…",
    att_records_warning: "Please select a session.",
    student_count: "{n} students",
    loading_data: "Loading...",
    no_sessions: "No sessions created yet.",
    no_student_data: "No student data.",
    resource_attached: "Resource Attached",
    all_marked_as: "All marked as {status}.",
    no_session_selected: "No active session selected.",
    select_session_first: "Select a session first.",
    no_students_found: "No students found.",
    present_chip: "Present",
    absent_chip: "Absent",
    unenroll_hint: "Unenroll",
    student_count_suffix: "students",
    view_attendance: "View Attendance",
    edit_date_type: "Edit Date/Type",
    restore_session: "Restore Session",
    cancel_session: "Cancel Session",
    delete_permanently: "Delete Permanently",
    open_linked_quiz: "Open Linked Quiz",
    student_unenrolled_toast: "Student unenrolled.",
    warn_ok: "✓ OK",
    warn_1: "⚠ Warn 1",
    warn_2: "⚠⚠ Warn 2",
    warn_dep: "🚫 Deprived",
    logout_failed: "Logout failed.",
    profile_updated: "Profile updated successfully.",
    quiz_updated: "Quiz updated.",
    quiz_created: "Quiz created.",
    session_created: "Session created.",
    session_updated: "Session updated.",
    downloading: "Downloading...",
    course_created: "Course created.",
    user_created: "User created.",
    group_division: "Group Division",
    number_of_groups: "Number of Groups",
    divide_btn: "Divide Students",
    no_groups_yet: "Enter the number of groups and click Divide.",
    group_label: "Group",
    role_instructor: "Instructor",
    role_admin: "Administrator",
    account_info: "Account Information",
    security_label: "Security",
    profile_updated: "Profile updated successfully.",
    username_label: "Username",
    ui_style: "Interface Style",
    modern_ui: "Modern UI",
    modern_ui_desc: "Enhanced design with glassmorphism and animations.",
    simple_ui: "Simple UI",
    simple_ui_desc: "The classic, minimal layout for maximum focus.",
    chatbot_name: "Assistant AI",
    chatbot_online: "Online",
    chatbot_welcome: "Hello! I am your AI assistant. I can help you with student counts, absences, quiz stats, or warnings for your courses. What would you like to know?",
    chatbot_placeholder: "Ask about your courses...",
    chatbot_thinking: "Thinking..."
  },
  ar: {
    dashboard: "لوحة التحكم",
    courses: "المقررات الدراسية",
    nav_admin: "إعدادات المسؤول",
    nav_docs: "دليل الاستخدام",
    dash_overview: "نظرة عامة",
    dash_subtitle: "إحصائيات الحضور والغياب بلمحة سريعة",
    total_courses: "إجمالي المقررات",
    total_students: "إجمالي الطلاب",
    total_sessions: "إجمالي الجلسات",
    avg_attendance: "متوسط نسبة الحضور",
    docs_title: "دليل المستخدم التعليمي",
    docs_subtitle: "تعرف على كيفية استخدام نظام AttendEase بفعالية",
    profile: "الملف الشخصي",
    logout: "تسجيل الخروج",
    welcome: "مرحباً",
    login: "تسجيل الدخول",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    forgot_password: "نسيت كلمة المرور؟",
    courses_subtitle: "اختر مقرراً دراسياً لإدارة المحاضرات، الطلاب، ومتابعة الغياب",
    new_course: "مقرر جديد",
    table_course: "المقرر",
    table_code: "كود المقرر",
    table_students: "الطلاب",
    table_sessions: "الجلسات",
    table_rate: "نسبة الحضور",
    table_progress: "معدل الإنجاز",
    loading: "جاري التحميل...",
    login_btn: "دخول",
    login_subtitle: "يرجى تسجيل الدخول لإدارة مقرراتك الدراسية",
    placeholder_user: "مثال: admin",
    placeholder_pass: "••••••••",
    forgot_link: "هل نسيت كلمة المرور؟",
    reset_subtitle: "تعيين كلمة مرور جديدة",
    send_reset: "إرسال رابط الاستعادة",
    back_to_login: "العودة لصفحة الدخول",
    profile_title: "الملف الشخصي",
    confirm_password_label: "تأكيد كلمة المرور",
    passwords_dont_match: "كلمات المرور غير متطابقة.",
    new_password_label: "كلمة المرور الجديدة",
    placeholder_confirm: "أعد كتابة كلمة المرور",
    save_changes: "حفظ التغييرات",
    // Docs Sections
    doc_courses_title: "إدارة المقررات الدراسية",
    doc_courses_steps: [
      "انتقل إلى تبويب 'المقررات' من القائمة الجانبية.",
      "انقر على 'مقرر جديد' لإنشاء وحدة دراسية جديدة.",
      "قم بإدارة قوائم الطلاب عبر رفع ملفات Excel أو الإضافة اليدوية."
    ],
    doc_sessions_title: "المحاضرات وجلسات الحضور",
    doc_sessions_steps: [
      "افتح المقرر الدراسي وانتقل إلى تبويب 'الجلسات'.",
      "سجل الحضور بسرعة باستخدام 'التحضير السريع' عبر الرقم الجامعي.",
      "ميز بين المحاضرات (Lectures) والتمارين/المعامل (Labs/Sections) بسهولة."
    ],
    doc_quizzes_title: "الاختبارات القصيرة والتقييم",
    doc_quizzes_steps: [
      "اربط الاختبارات بجلسات محددة أو أنشئها بشكل مستقل.",
      "ارفع ملفات الاختبار ونماذج الإجابة لرجوع الطلاب إليها.",
      "أدخل الدرجات بسرعة باستخدام واجهة رصد الدرجات المطورة."
    ],
    doc_reports_title: "التقارير وتصدير البيانات",
    doc_reports_steps: [
      "استخرج مستندات إنذارات الغياب تلقائياً بناءً على الحد المسموح به.",
      "صدر تقارير الحضور والدرجات بصيغ Excel أو Word أو PDF.",
      "راقب تقدم الطلاب عبر الرسوم البيانية ومؤشرات الأداء البصرية."
    ],
    course_breakdown: "تفاصيل المقررات",
    sidebar_profile: "الملف الشخصي",
    sidebar_logout: "تسجيل الخروج",
    new_course_btn: "مقرر جديد",
    back_to_courses: "المقررات",
    tab_sessions: "الجلسات",
    tab_students: "الطلاب",
    tab_settings: "الإعدادات",
    tab_quizzes: "الاختبارات",
    manage_sessions: "إدارة الجلسات",
    sessions_subtitle: "الجدول الزمني للمقرر والجلسات المزدوجة",
    new_session_btn: "جلسة جديدة",
    lec_sessions: "المحاضرات (Lec)",
    lab_sessions: "التمارين/المعامل (Lab/Sec)",
    back_to_sessions: "العودة للجلسات",
    quick_attendance: "التحضير السريع",
    quick_attendance_hint: "أدخل الرقم الجامعي ← ثم اضغط Enter",
    placeholder_id: "أدخل الرقم الجامعي...",
    mark_present: "تسجيل حضور",
    roster_title: "قائمة الحضور والغياب",
    filter_students: "تصفية الطلاب...",
    mark_all_present: "حضور الكل",
    mark_all_absent: "غياب الكل",
    export_btn: "تصدير",
    add_student_btn: "إضافة طالب",
    table_id: "الرقم الجامعي",
    table_name: "الاسم",
    table_status: "حالة اليوم",
    table_lec_abs: "غياب المحاضرات",
    table_lab_abs: "غياب التمارين",
    table_warning: "الإنذار",
    enrolled_students: "الطلاب المسجلين",
    import_excel: "استيراد من Excel",
    add_enroll: "إضافة / تسجيل",
    search_enrolled: "البحث في الطلاب المسجلين...",
    quick_add_student: "إضافة سريعة لطالب",
    print_warning: "طباعة الإنذار الأول",
    import_template_title: "لا تملك الملف بعد؟",
    import_template_sub: "قم بتحميل النموذج الجاهز — املأ بياناتك ثم ارفعه مرة أخرى.",
    download_template: "تحميل النموذج",
    import_drag_drop: "اسحب ملف .xlsx هنا، أو",
    browse_file: "تصفح الملفات",
    import_hint: "الأعمدة المطلوبة: الرقم الجامعي، اسم الطالب",
    enroll_selected: "تسجيل المحددين",
    new_student: "طالب جديد",
    course_settings: "تفاصيل المقرر",
    course_name_label: "اسم المقرر",
    course_code_label: "كود المقرر",
    sync_records: "مزامنة السجلات",
    danger_zone: "منطقة الخطر",
    danger_desc: "حذف هذا المقرر وجميع بياناته بشكل نهائي.",
    delete_course_btn: "حذف المقرر",
    absence_thresholds: "حدود إنذارات الغياب",
    absence_thresholds_desc: "عدد الغيابات التي تستوجب كل مستوى من مستويات الإنذار.",
    warn_1st: "⚠ الإنذار الأول",
    warn_2nd: "⚠⚠ الإنذار الثاني",
    deprivation: "🚫 الحرمان",
    absence_weights: "أوزان الغياب (Absence Weights)",
    absence_weights_desc: "يتم تحويل كل غياب إلى نقاط — يتم مقارنة المجموع بالحدود المذكورة أعلاه.",
    pts_unit: "نقطة",
    pt_abs_unit: "نقطة / غياب",
    score_formula: "النتيجة = (غياب المحاضرات × {lw}) + (غياب التمارين × {sw})",
    no_students_enrolled: "لا يوجد طلاب مسجلين.",
    no_matching_students: "لا يوجد طلاب مطابقين للبحث.",
    save_thresholds: "حفظ الحدود",
    manage_quizzes: "إدارة الاختبارات القصيرة",
    quizzes_subtitle: "درجات الاختبارات وتقييم الطلاب",
    new_quiz_btn: "اختبار جديد",
    quizzes_overview: "نظرة عامة على الاختبارات (جدول)",
    quiz_back: "العودة للاختبارات",
    quick_grade_entry: "رصد الدرجات السريع",
    quick_grade_hint: "الرقم الجامعي ← الدرجة ← Enter",
    save_grade: "حفظ الدرجة",
    grade_list: "قائمة الدرجات",
    export_quiz: "تصدير الاختبار",
    total_score: "إجمالي الدرجات",
    attendance: "الحضور",
    admin_subtitle: "إدارة مستخدمي النظام والإعدادات العامة",
    new_instructor: "محاضر جديد",
    manage_instructors: "إدارة المحاضرين",
    role: "الدور / الصلاحية",
    table_actions: "الإجراءات",
    full_name: "الاسم الكامل",
    placeholder_name: "مثال: د. أحمد محمد",
    email_label: "البريد الإلكتروني",
    placeholder_email: "example@univ.edu.eg",
    new_password_label: "كلمة المرور الجديدة",
    placeholder_pass_hint: "اتركه فارغاً للاحتفاظ بكلمة المرور الحالية",
    cancel: "إلغاء",
    add_instructor_title: "إضافة محاضر جديد",
    grant_admin: "منح صلاحيات المسؤول (Administrator)",
    create_user: "إنشاء مستخدم",
    course_placeholder: "مثال: هياكل البيانات",
    code_placeholder: "مثال: CS201",
    create_course: "إنشاء المقرر",
    new_session_title: "جلسة حضور جديدة",
    session_type: "نوع الجلسة",
    lecture_ar: "محاضرة (Lecture)",
    section_label: "تمارين (Section)",
    section_ar: "سكشن / تمارين",
    lab_label: "معمل (Lab)",
    lab_ar: "لاب / معمل",
    placeholder_id_add: "مثال: 20240001",
    placeholder_name_add: "مثال: أحمد محمد خليل",
    quick_quiz_title: "دمج اختبار سريع (Quick Quiz)",
    create_quiz_session: "هل تريد إنشاء اختبار لهذه الجلسة؟",
    quiz_name_placeholder: "مثال: نشاط صففي / اختبار",
    max_score: "الدرجة القصوى",
    att_marker: "عامل حضور؟",
    recorded: "تم التسجيل",
    not_recorded: "لم يتم التسجيل",
    present: "حاضر",
    absent: "غائب",
    cancelled: "ملغاة",
    lecture: "محاضرة",
    lab: "معمل",
    section: "تمارين",
    id_label: "الرقم",
    grade_label: "الدرجة",
    attendance_label: "الحضور",
    success_label: "نجاح",
    error_label: "خطأ",
    graded: "مصحح",
    pending: "غير مرصود",
    quiz_back: "العودة للاختبارات",
    sessions_back: "العودة للجلسات",
    quiz_title_label: "الاختبار",
    date_label: "التاريخ",
    quiz_max_label: "الدرجة القصوى",
    student_list_label: "قائمة الطلاب",
    not_linked: "غير مرتبط بجلسة",
    attendance_yes: "حضور؟",
    session_linked: "الجلسة المرتبطة",
    files_label: "المصادر والمواد",
    total_label: "الإجمالي",
    choose_quiz_file: "ملف الاختبار",
    choose_answer_file: "نموذج الإجابة",
    new_quiz_title: "اختبار جديد",
    edit_quiz_title: "تعديل الاختبار",
    gen_info: "المعلومات العامة",
    optional_label: "(اختياري)",
    notes_label: "ملاحظات",
    att_int: "تكامل الحضور",
    att_label_short: "حضور؟",
    delete_user_title: "حذف المستخدم",
    delete_session_title: "حذف الجلسة",
    delete_course_title: "حذف المقرر",
    delete_quiz_title: "حذف الاختبار",
    unenroll_title: "إلغاء تسجيل طالب",
    export_options: "خيارات التصدير",
    export_desc: "اختر معلومات الطالب التي تريد تضمينها في الملف:",
    ids_names: "الأرقام الجامعية والأسماء",
    ids_names_desc: "تضمين كل من الأرقام الجامعية والأسماء الكاملة.",
    ids_only: "الأرقام الجامعية فقط",
    ids_only_desc: "تصدير الأرقام الجامعية فقط (سيتم إخفاء الأسماء).",
    download_now: "تنزيل الآن",
    delete_user_confirm: "هل أنت متأكد من حذف المستخدم \"{name}\"؟\nتحذير: سيتم حذف جميع المقررات الخاصة به أيضاً!",
    delete_session_confirm: "هل تريد حذف هذه الجلسة وجميع سجلات الحضور الخاصة بها نهائياً؟",
    delete_course_confirm: "حذف هذا المقرر وجميع بياناته؟ لا يمكن التراجع عن هذا الإجراء.",
    delete_quiz_confirm: "هل أنت متأكد من حذف هذا الاختبار وجميع درجات الطلاب الخاصة به؟",
    unenroll_confirm: "إلغاء تسجيل هذا الطالب من المقرر؟",
    cancel_btn: "إلغاء",
    confirm_btn: "تأكيد",
    save_quiz_btn: "حفظ الاختبار",
    placeholder_quiz_name: "مثال: اختبار 1، مادتيرم…", 
    placeholder_quiz_notes: "مثال: المواضيع المغطاة، مستوى الصعوبة…",
    att_records_warning: "اختر جلسة.",
    student_count: "{n} طالب",
    loading_data: "جاري التحميل...",
    no_sessions: "لم يتم إنشاء جلسات بعد.",
    no_student_data: "لا توجد بيانات طلاب.",
    resource_attached: "يوجد ملف مرفق",
    all_marked_as: "تم تحديد الكل كـ {status}.",
    no_session_selected: "لم يتم اختيار جلسة نشطة.",
    select_session_first: "اختر جلسة أولاً.",
    no_students_found: "لم يتم العثور على طلاب.",
    present_chip: "حاضر",
    absent_chip: "غائب",
    unenroll_hint: "إلغاء التسجيل",
    student_count_suffix: "طالب",
    view_attendance: "عرض الحضور",
    edit_date_type: "تعديل التاريخ/النوع",
    restore_session: "استعادة الجلسة",
    cancel_session: "إلغاء الجلسة",
    delete_permanently: "حذف نهائي",
    open_linked_quiz: "فتح الاختبار المرتبط",
    student_unenrolled_toast: "تم إلغاء تسجيل الطالب.",
    warn_ok: "✓ جيد",
    warn_1: "⚠ إنذار 1",
    warn_2: "⚠⚠ إنذار 2",
    warn_dep: "🚫 حرمان",
    logout_failed: "فشل تسجيل الخروج.",
    profile_updated: "تم تحديث الملف الشخصي بنجاح.",
    quiz_updated: "تم تحديث الاختبار.",
    quiz_created: "تم إنشاء الاختبار.",
    session_created: "تم إنشاء الجلسة.",
    session_updated: "تم تحديث الجلسة.",
    downloading: "جاري التحميل...",
    course_created: "تم إنشاء المقرر.",
    user_created: "تم إنشاء المستخدم.",
    group_division: "تقسيم المجموعات",
    number_of_groups: "عدد المجموعات",
    divide_btn: "تقسيم الطلاب",
    no_groups_yet: "أدخل عدد المجموعات ثم انقر على تقسيم.",
    group_label: "المجموعة",
    ui_style: "نمط الواجهة",
    modern_ui: "الواجهة المعاصرة",
    modern_ui_desc: "تصميم عصري باستخدام التأثيرات الزجاجية والرسوم المتحركة.",
    simple_ui: "الواجهة البسيطة",
    simple_ui_desc: "التصميم الكلاسيكي البسيط للتركيز الأقصى.",
    chatbot_name: "المساعد الذكي",
    chatbot_online: "متصل الآن",
    chatbot_welcome: "مرحباً! أنا مساعدك الذكي. يمكنني مساعدتك في معرفة أعداد الطلاب، الغيابات، إحصائيات الاختبارات، أو الإنذارات الخاصة بمقرراتك. ماذا تريد أن تعرف؟",
    chatbot_placeholder: "اسأل عن مقرراتك...",
    chatbot_thinking: "جاري التفكير..."
  }
};

function updateUI() {
  const isAr = currentLang === 'ar';
  document.documentElement.lang = currentLang;
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
  document.title = isAr ? 'نظام AttendEase — إدارة حضور الطلاب' : 'AttendEase — Student Attendance Management';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLang][key]) {
      el.textContent = translations[currentLang][key];
    }
  });
  
  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[currentLang][key]) {
      el.placeholder = translations[currentLang][key];
    }
  });
  
  // Custom updates
  document.getElementById('btn-lang-en').classList.toggle('active', currentLang === 'en');
  document.getElementById('btn-lang-ar').classList.toggle('active', currentLang === 'ar');
  
  if (activeView === 'docs') renderDocumentation();
  
  // Reload current state if in course detail
  if (currentCourseId) {
    if (document.getElementById('dtab-sessions')?.classList.contains('hidden') === false) {
      loadSessions(currentCourseId);
    }
    if (document.getElementById('dtab-students')?.classList.contains('hidden') === false) {
      loadEnrolledStudents(currentCourseId);
    }
    if (document.getElementById('dtab-quizzes')?.classList.contains('hidden') === false) {
      loadQuizzes(currentCourseId);
      loadQuizSummary(currentCourseId);
    }
    if (currentSessionId) {
      loadRoster(currentSessionId);
    }
    if (currentQuizId) {
      loadQuizRoster(currentQuizId);
    }
  }

  updateClock();
}

window.setLanguage = function(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  updateUI();
};

async function checkAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('reset_token');

  if (resetToken) {
    document.getElementById('app-layout').classList.add('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('forgot-screen').classList.add('hidden');
    document.getElementById('reset-screen').classList.remove('hidden');
    return;
  }

  try {
    currentUser = await apiFetch('/auth/me');
    showApp();
  } catch (e) {
    showLogin();
  }
}

function hideAllAuthScreens() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('forgot-screen').classList.add('hidden');
  document.getElementById('reset-screen').classList.add('hidden');
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('otp-screen').classList.add('hidden');
}

function showLogin() {
  document.getElementById('app-layout').classList.add('hidden');
  hideAllAuthScreens();
  document.getElementById('login-screen').classList.remove('hidden');
}

function showRegister() {
  document.getElementById('app-layout').classList.add('hidden');
  hideAllAuthScreens();
  document.getElementById('register-screen').classList.remove('hidden');
}

function showForgot() {
  document.getElementById('app-layout').classList.add('hidden');
  hideAllAuthScreens();
  document.getElementById('forgot-screen').classList.remove('hidden');
}

function showOTP(email) {
  document.getElementById('app-layout').classList.add('hidden');
  hideAllAuthScreens();
  currentRegistrationEmail = email;
  document.getElementById('otp-email-display').textContent = email;
  document.getElementById('otp-screen').classList.remove('hidden');
  // clear inputs
  document.querySelectorAll('.otp-box').forEach(b => { b.value = ''; b.classList.remove('filled'); });
  document.getElementById('otp-0').focus();
}

function showApp() {
  hideAllAuthScreens();
  document.getElementById('app-layout').classList.remove('hidden');
  switchView('dashboard');
  if (currentUser) {
    const L = translations[currentLang];
    // Update sidebar user info
    const nameDisp = document.getElementById('sidebar-user-name-display');
    if (nameDisp) nameDisp.textContent = currentUser.name || currentUser.username;
    
    const roleDisp = document.getElementById('sidebar-user-role-display');
    if (roleDisp) roleDisp.textContent = currentUser.is_admin ? L.role_admin : L.role_instructor;
    
    const initialDisp = document.getElementById('user-initials');
    if (initialDisp) {
      const name = currentUser.name || currentUser.username;
      const parts = name.split(' ');
      initialDisp.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
    }

    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.classList.toggle('hidden', !currentUser.is_admin);
  }
}

let currentRegistrationEmail = '';

function _applyPasswordStrength(val, suffix='') {
  const bar = document.getElementById('pw-strength-fill' + suffix);
  const rules = {
    len: val.length >= 8,
    upper: /[A-Z]/.test(val),
    lower: /[a-z]/.test(val),
    num: /\d/.test(val),
    special: /[^A-Za-z0-9]/.test(val)
  };
  
  let score = 0;
  for (const k in rules) {
    const el = document.getElementById(`rule-${k}${suffix}`);
    if (el) {
      if (rules[k]) {
        el.className = 'rule-ok';
        el.textContent = '✓ ' + el.textContent.substring(2);
        score++;
      } else {
        el.className = 'rule-bad';
        el.textContent = '○ ' + el.textContent.substring(2);
      }
    }
  }

  const colors = ['#4a5568', '#ef4444', '#f59e0b', '#f59e0b', '#10b981', '#10b981'];
  if (bar) {
    bar.style.width = (score * 20) + '%';
    bar.style.backgroundColor = colors[score];
  }
  return score === 5;
}

function updatePasswordStrength(val) { return _applyPasswordStrength(val, ''); }
window.updatePasswordStrengthProfile = (val) => _applyPasswordStrength(val, '-profile');
window.updatePasswordStrengthReset = (val) => _applyPasswordStrength(val, '-reset');

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirmObj = document.getElementById('reg-confirm').value;
  const btn = document.getElementById('btn-register');
  const err = document.getElementById('reg-error');

  const isAr = currentLang === 'ar';

  const confirm = document.getElementById('reg-confirm').value;
  const errConfirm = document.getElementById('error-reg-confirm');
  
  if (!name || !email || !password) {
    err.textContent = isAr ? 'يرجى تعبئة جميع الحقول.' : 'Please fill all fields.';
    err.classList.remove('hidden');
    return;
  }
  
  if (password !== confirm) {
    errConfirm.textContent = translations[currentLang].passwords_dont_match;
    errConfirm.classList.remove('hidden');
    return;
  } else {
    errConfirm.classList.add('hidden');
  }

  if (!updatePasswordStrength(password)) {
    err.textContent = isAr ? 'كلمة المرور ضعيفة.' : 'Please fix password requirements.';
    err.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-sm"></span> ${isAr ? 'جاري الإرسال...' : 'Sending OTP...'}`;
  err.classList.add('hidden');

  try {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    toast(isAr ? 'تم إرسال رمز التحقق إلى بريدك!' : 'Verification code sent to your email!', 'success');
    showOTP(email);
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = isAr ? 'إنشاء حساب' : 'Create Account';
  }
}

async function doVerifyOTP() {
  let code = '';
  document.querySelectorAll('.otp-box').forEach(b => code += b.value);
  const btn = document.getElementById('btn-verify-otp');
  const err = document.getElementById('otp-error');
  const succ = document.getElementById('otp-success');
  const isAr = currentLang === 'ar';

  if (code.length !== 6) {
    err.textContent = isAr ? 'الرجاء إدخال الرمز المكون من 6 أرقام.' : 'Please enter the 6-digit code.';
    err.classList.remove('hidden');
    succ.classList.add('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-sm"></span> ${isAr ? 'جاري التحقق...' : 'Verifying code...'}`;
  err.classList.add('hidden');
  succ.classList.add('hidden');

  try {
    const res = await apiFetch('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email: currentRegistrationEmail, code })
    });
    // On success
    showSuccess('otp-success', res.message);
    
    // Switch to login after 3 seconds
    setTimeout(() => {
      showLogin();
      showSuccess('login-success', res.message);
    }, 3000);
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = isAr ? 'تأكيد البريد' : 'Verify Email';
  }
}

async function doResendOTP() {
  const isAr = currentLang === 'ar';
  const aResend = document.getElementById('link-resend-otp');
  const err = document.getElementById('otp-error');
  const succ = document.getElementById('otp-success');

  err.classList.add('hidden');
  succ.classList.add('hidden');
  aResend.style.pointerEvents = 'none';
  aResend.style.opacity = '0.5';

  try {
    const res = await apiFetch('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email: currentRegistrationEmail })
    });
    showSuccess('otp-success', res.message);
    // Removed toast to avoid duplicate messages
  } catch(e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  } finally {
    setTimeout(() => {
      aResend.style.pointerEvents = 'auto';
      aResend.style.opacity = '1';
    }, 15000); // 15s cooldown
  }
}

async function doLogin() {
  const userEl = document.getElementById('login-username');
  const passEl = document.getElementById('login-password');
  const btn = document.getElementById('btn-login');
  const err = document.getElementById('login-error');
  const username = userEl.value.trim();
  const password = passEl.value;

  if(!username || !password) {
    err.textContent = 'Please enter both username and password';
    err.classList.remove('hidden');
    return;
  }
  const isAr = currentLang === 'ar';
  btn.innerHTML = `<span class="spinner-sm"></span> ${isAr ? 'جاري الدخول...' : 'Logging in...'}`;
  btn.disabled = true;
  err.classList.add('hidden');
  
  try {
    currentUser = await apiFetch('/auth/login', {
       method: 'POST',
       body: JSON.stringify({username, password})
    });
    userEl.value = '';
    passEl.value = '';
    showApp();
  } catch(e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
  } finally {
    btn.textContent = isAr ? 'تسجيل الدخول' : 'Log In';
    btn.disabled = false;
  }
}

async function doLogout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
    currentUser = null;
    currentCourseId = null;
    coursesCache = {};
    showLogin();
  } catch(e) {
    toast(translations[currentLang].logout_failed, 'error');
  }
}

async function doForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  const btn = document.getElementById('btn-send-reset');
  const err = document.getElementById('forgot-error');
  const succ = document.getElementById('forgot-success');
  
  const isAr = currentLang === 'ar';
  
  if (!email) {
    err.textContent = isAr ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email address';
    err.classList.remove('hidden');
    succ.classList.add('hidden');
    return;
  }
  
  btn.innerHTML = `<span class="spinner-sm"></span> ${isAr ? 'جاري الإرسال...' : 'Sending reset link...'}`;
  btn.disabled = true;
  err.classList.add('hidden');
  succ.classList.add('hidden');
  
  try {
    const res = await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({email})
    });
    
    showSuccess('forgot-success', res.message);
    // Removed toast to avoid duplicate messages
  } catch(e) {
    // This now catches 404 from backend if email doesn't exist
    err.textContent = e.message;
    err.classList.remove('hidden');
  } finally {
    btn.innerHTML = isAr ? 'إرسال رابط الاستعادة' : 'Send Reset Link';
    btn.disabled = false;
  }
}

async function doResetPassword() {
  const isAr = currentLang === 'ar';
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('reset_token');
  const new_password = document.getElementById('reset-password').value;
  const confirm = document.getElementById('reset-confirm').value;
  const btn = document.getElementById('btn-reset-password');
  const err = document.getElementById('reset-error');
  const errConfirm = document.getElementById('error-reset-confirm');
  const succ = document.getElementById('reset-success');

  if (!new_password) {
    err.textContent = isAr ? 'يرجى إدخال كلمة المرور الجديدة' : 'Please enter a new password';
    err.classList.remove('hidden');
    return;
  } else {
    err.classList.add('hidden');
  }

  if (new_password !== confirm) {
    errConfirm.textContent = translations[currentLang].passwords_dont_match;
    errConfirm.classList.remove('hidden');
    return;
  } else {
    errConfirm.classList.add('hidden');
  }

  if (!token) {
    err.textContent = isAr ? 'رابط إعادة التعيين غير صالح.' : 'Invalid reset link.';
    err.classList.remove('hidden');
    return;
  }

  btn.innerHTML = `<span class="spinner-sm"></span> ${isAr ? 'جاري التحديث...' : 'Updating password...'}`;
  btn.disabled = true;
  err.classList.add('hidden');
  if (succ) succ.classList.add('hidden');

  try {
    await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password })
    });

    // Show success message on the page
    if (succ) {
      const msg = isAr
        ? 'تم تعيين كلمة المرور بنجاح! سيتم توجيهك لصفحة تسجيل الدخول...'
        : 'Password reset successfully! Redirecting to login...';
      showSuccess('reset-success', msg);
    } else {
      btn.textContent = isAr ? '✅ تم بنجاح!' : '✅ Done!';
    }

    // Redirect after short delay so user sees success message
    setTimeout(() => {
      // Remove reset_token from URL then navigate cleanly
      window.location.replace('/');
    }, 2000);

  } catch(e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
    btn.textContent = isAr ? 'تحديث كلمة المرور' : 'Update Password';
    btn.disabled = false;
  }
}

let currentCourseData = null;
let currentSessionId  = null;
let currentSessionType= null;
let sessionRecords    = [];
let warningsMap       = {};

/* ══════════════════════════════════════════════════════════════════════════
   CLOCK  (safe — uses getElementById with null-check inside)
══════════════════════════════════════════════════════════════════════════ */

function updateClock() {
  const now = new Date();
  const locale = currentLang === 'ar' ? 'ar-EG' : 'en-US';
  const t = document.getElementById('sidebar-time');
  if (t) t.textContent = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const d = document.getElementById('topbar-date');
  if (d) d.textContent = now.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}
setInterval(updateClock, 1000);

/* ══════════════════════════════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════════════════════════════ */

const VIEWS   = ['dashboard', 'courses', 'admin', 'docs'];
let activeView = 'dashboard';

function switchView(name) {
  activeView = name;
  VIEWS.forEach(v => {
    document.getElementById(`view-${v}`)?.classList.toggle('active', v === name);
    document.getElementById(`nav-${v}`)?.classList.toggle('active', v === name);
  });
  
  let breadcrumbKey = 'dashboard';
  if (name === 'courses') breadcrumbKey = 'courses';
  if (name === 'admin')   breadcrumbKey = 'nav_admin';
  if (name === 'docs')    breadcrumbKey = 'nav_docs';
  
  updateBreadcrumb(breadcrumbKey);
  if (window.innerWidth <= 720) document.getElementById('sidebar').classList.remove('open');
  
  if (name === 'dashboard') loadDashboard();
  if (name === 'courses')   showCourseList();
  if (name === 'admin') {
    loadUsers();
    loadEmailSettings();
  }
  if (name === 'docs')      renderDocumentation();
}

function renderDocumentation() {
  const container = document.getElementById('docs-content');
  if (!container) return;
  const L = translations[currentLang];
  const isAr = currentLang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const sections = [
    {
      key: 'doc_courses',
      color: 'var(--blue)',
      glow: 'var(--blue-glow)',
      gradFrom: 'rgba(79,142,247,0.15)',
      gradTo: 'rgba(155,114,247,0.08)',
      border: 'rgba(79,142,247,0.3)',
      svgBg: '#1a2540',
      illustration: `
        <circle cx="60" cy="60" r="50" fill="rgba(79,142,247,0.12)" stroke="rgba(79,142,247,0.3)" stroke-width="1"/>
        <rect x="30" y="38" width="60" height="44" rx="6" fill="rgba(79,142,247,0.2)" stroke="rgba(79,142,247,0.5)" stroke-width="1.5"/>
        <line x1="38" y1="50" x2="82" y2="50" stroke="rgba(79,142,247,0.6)" stroke-width="2" stroke-linecap="round"/>
        <line x1="38" y1="58" x2="72" y2="58" stroke="rgba(155,114,247,0.5)" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="38" y1="66" x2="76" y2="66" stroke="rgba(79,142,247,0.4)" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="88" cy="38" r="12" fill="rgba(61,214,140,0.2)" stroke="rgba(61,214,140,0.5)" stroke-width="1.5"/>
        <path d="M84 38 l3 3 5-5" stroke="rgba(61,214,140,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M20 70 L20 50 C20 45 25 40 30 38" stroke="rgba(155,114,247,0.4)" stroke-width="1.5" fill="none" stroke-dasharray="3 2"/>
      `,
      tip_en: 'Tip: You can upload an Excel file with student names and IDs to instantly populate a course!',
      tip_ar: 'نصيحة: يمكنك رفع ملف Excel بأسماء وأرقام الطلاب لملء المقرر فوراً!'
    },
    {
      key: 'doc_sessions',
      color: 'var(--green)',
      glow: 'var(--green-glow)',
      gradFrom: 'rgba(61,214,140,0.12)',
      gradTo: 'rgba(54,192,192,0.06)',
      border: 'rgba(61,214,140,0.3)',
      svgBg: '#162535',
      illustration: `
        <circle cx="60" cy="60" r="50" fill="rgba(61,214,140,0.08)" stroke="rgba(61,214,140,0.25)" stroke-width="1"/>
        <rect x="28" y="28" width="64" height="64" rx="8" fill="rgba(61,214,140,0.12)" stroke="rgba(61,214,140,0.4)" stroke-width="1.5"/>
        <line x1="28" y1="44" x2="92" y2="44" stroke="rgba(61,214,140,0.3)" stroke-width="1"/>
        <circle cx="40" cy="36" r="4" fill="rgba(61,214,140,0.4)"/>
        <circle cx="52" cy="36" r="4" fill="rgba(61,214,140,0.4)"/>
        <rect x="36" y="52" width="12" height="12" rx="3" fill="rgba(61,214,140,0.25)" stroke="rgba(61,214,140,0.5)" stroke-width="1"/>
        <path d="M38.5 58 l2.5 2.5 4-4" stroke="rgba(61,214,140,0.9)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <rect x="54" y="52" width="12" height="12" rx="3" fill="rgba(61,214,140,0.25)" stroke="rgba(61,214,140,0.5)" stroke-width="1"/>
        <path d="M56.5 58 l2.5 2.5 4-4" stroke="rgba(61,214,140,0.9)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <rect x="72" y="52" width="12" height="12" rx="3" fill="rgba(244,91,105,0.15)" stroke="rgba(244,91,105,0.4)" stroke-width="1"/>
        <line x1="75" y1="55" x2="81" y2="61" stroke="rgba(244,91,105,0.7)" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="81" y1="55" x2="75" y2="61" stroke="rgba(244,91,105,0.7)" stroke-width="1.5" stroke-linecap="round"/>
        <rect x="36" y="70" width="12" height="12" rx="3" fill="rgba(61,214,140,0.25)" stroke="rgba(61,214,140,0.5)" stroke-width="1"/>
        <path d="M38.5 76 l2.5 2.5 4-4" stroke="rgba(61,214,140,0.9)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <rect x="54" y="70" width="12" height="12" rx="3" fill="rgba(61,214,140,0.1)" stroke="rgba(61,214,140,0.3)" stroke-width="1"/>
        <rect x="72" y="70" width="12" height="12" rx="3" fill="rgba(61,214,140,0.1)" stroke="rgba(61,214,140,0.3)" stroke-width="1"/>
      `,
      tip_en: 'Tip: Use Quick Mark and scan student IDs one by one — it\'s the fastest way to take attendance!',
      tip_ar: 'نصيحة: استخدم التحضير السريع وأدخل أرقام الطلاب تباعاً — إنها أسرع طريقة!'
    },
    {
      key: 'doc_quizzes',
      color: 'var(--violet)',
      glow: 'var(--violet-glow)',
      gradFrom: 'rgba(155,114,247,0.15)',
      gradTo: 'rgba(247,183,49,0.06)',
      border: 'rgba(155,114,247,0.3)',
      svgBg: '#1d1a35',
      illustration: `
        <circle cx="60" cy="60" r="50" fill="rgba(155,114,247,0.1)" stroke="rgba(155,114,247,0.25)" stroke-width="1"/>
        <rect x="32" y="28" width="44" height="56" rx="5" fill="rgba(155,114,247,0.15)" stroke="rgba(155,114,247,0.4)" stroke-width="1.5"/>
        <line x1="40" y1="42" x2="68" y2="42" stroke="rgba(155,114,247,0.5)" stroke-width="2" stroke-linecap="round"/>
        <line x1="40" y1="52" x2="64" y2="52" stroke="rgba(155,114,247,0.35)" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="40" y1="62" x2="68" y2="62" stroke="rgba(155,114,247,0.35)" stroke-width="1.5" stroke-linecap="round"/>
        <rect x="40" y="70" width="28" height="7" rx="3.5" fill="rgba(247,183,49,0.25)" stroke="rgba(247,183,49,0.5)" stroke-width="1"/>
        <text x="54" y="76.5" font-size="5" fill="rgba(247,183,49,0.9)" text-anchor="middle">8.5 / 10</text>
        <circle cx="84" cy="40" r="14" fill="rgba(155,114,247,0.2)" stroke="rgba(155,114,247,0.5)" stroke-width="1.5"/>
        <path d="M80 40 l3 3 5-5" stroke="rgba(155,114,247,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <circle cx="84" cy="70" r="10" fill="rgba(247,183,49,0.15)" stroke="rgba(247,183,49,0.4)" stroke-width="1.5"/>
        <text x="84" y="73.5" font-size="8" fill="rgba(247,183,49,0.9)" text-anchor="middle">A</text>
      `,
      tip_en: 'Tip: A quiz can double as an attendance marker — enable the attendance option when creating it!',
      tip_ar: 'نصيحة: يمكن للكويز أن يُسجَّل حضوراً أيضاً — فعّل خيار الحضور عند إنشائه!'
    },
    {
      key: 'doc_reports',
      color: 'var(--teal)',
      glow: 'var(--teal-glow)',
      gradFrom: 'rgba(54,192,192,0.12)',
      gradTo: 'rgba(79,142,247,0.06)',
      border: 'rgba(54,192,192,0.3)',
      svgBg: '#162530',
      illustration: `
        <circle cx="60" cy="60" r="50" fill="rgba(54,192,192,0.08)" stroke="rgba(54,192,192,0.25)" stroke-width="1"/>
        <rect x="28" y="75" width="14" height="18" rx="2" fill="rgba(54,192,192,0.3)" stroke="rgba(54,192,192,0.5)" stroke-width="1"/>
        <rect x="47" y="60" width="14" height="33" rx="2" fill="rgba(79,142,247,0.3)" stroke="rgba(79,142,247,0.5)" stroke-width="1"/>
        <rect x="66" y="48" width="14" height="45" rx="2" fill="rgba(61,214,140,0.3)" stroke="rgba(61,214,140,0.5)" stroke-width="1"/>
        <path d="M30 75 C40 55 50 70 62 48" stroke="rgba(247,183,49,0.6)" stroke-width="2" fill="none" stroke-linecap="round"/>
        <circle cx="30" cy="75" r="3" fill="rgba(247,183,49,0.8)"/>
        <circle cx="54" cy="60" r="3" fill="rgba(247,183,49,0.8)"/>
        <circle cx="73" cy="48" r="3" fill="rgba(247,183,49,0.8)"/>
        <path d="M82 30 L82 20 L92 20" stroke="rgba(244,91,105,0.5)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <circle cx="82" cy="30" r="6" fill="rgba(244,91,105,0.2)" stroke="rgba(244,91,105,0.5)" stroke-width="1.5"/>
        <line x1="82" y1="27" x2="82" y2="31" stroke="rgba(244,91,105,0.9)" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="82" cy="33.5" r="0.8" fill="rgba(244,91,105,0.9)"/>
      `,
      tip_en: 'Tip: Set the absence threshold in Course Settings. Students above it automatically get flagged for a warning letter!',
      tip_ar: 'نصيحة: حدد نسبة الغياب في إعدادات المقرر. الطلاب الذين يتخطونها يُرشَّحون تلقائياً لخطاب إنذار!'
    }
  ];

  const heroTitle = isAr ? 'دليل استخدام AttendEase' : 'AttendEase User Guide';
  const heroSub   = isAr ? 'استكشف ميزات النظام وكيفية استقطاب أقصى استفادة منه لإدارة حضور ودرجات طلابك.' : 'Discover all system features and how to leverage them for efficient student management.';

  container.innerHTML = `
    <div class="docs-hero" dir="${dir}">
      <div class="docs-hero-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      </div>
      <div class="docs-hero-text">
        <h2>${heroTitle}</h2>
        <p>${heroSub}</p>
      </div>
    </div>
    <div class="docs-sections">
      ${sections.map(sec => `
        <div class="docs-rich-card" style="border-color: ${sec.border}; background: linear-gradient(135deg, ${sec.gradFrom}, ${sec.gradTo});">
          <div class="docs-rich-top">
            <div class="docs-rich-illustration">
              <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="background:${sec.svgBg}; border-radius: 12px;">
                ${sec.illustration}
              </svg>
            </div>
            <div class="docs-rich-info" dir="${dir}">
              <div class="docs-rich-title" style="color:${sec.color}">
                <span class="docs-section-label">${isAr ? 'قسم التعليمات' : 'Tutorial Section'}</span>
                <h3>${L[sec.key + '_title']}</h3>
              </div>
              <div class="docs-steps-list">
                ${L[sec.key + '_steps'].map((step, idx) => `
                  <div class="docs-step-rich">
                    <div class="docs-step-num-rich" style="background:${sec.glow}; color:${sec.color}; border:1px solid ${sec.border};">${idx + 1}</div>
                    <div class="docs-step-text">${step}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="docs-tip" style="border-color:${sec.border}; background:${sec.glow};" dir="${dir}">
            <span style="font-style: normal; margin: 0 4px;">💡</span> <strong>${isAr ? 'نصيحة:' : 'Pro Tip:'}</strong> ${isAr ? sec.tip_ar : sec.tip_en}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ============================================================================
// ADMIN (EMAIL SETTINGS)
// ============================================================================

async function loadEmailSettings() {
  try {
    const data = await apiFetch('/admin/email-settings');
    const srv = document.getElementById('admin-smtp-server');
    const prt = document.getElementById('admin-smtp-port');
    const usr = document.getElementById('admin-smtp-user');
    const pss = document.getElementById('admin-smtp-pass');
    
    if (srv) srv.value = data.server || '';
    if (prt) prt.value = data.port || 587;
    if (usr) usr.value = data.user || '';
    if (pss) pss.value = data.password || ''; 
  } catch(e) { console.error('Failed to load email settings', e); }
}

async function saveEmailSettings() {
  const server   = document.getElementById('admin-smtp-server').value.trim();
  const port     = document.getElementById('admin-smtp-port').value;
  const user     = document.getElementById('admin-smtp-user').value.trim();
  const password = document.getElementById('admin-smtp-pass').value;
  
  const btn = document.getElementById('btn-save-smtp');
  const saved = document.getElementById('smtp-saved');
  
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = translations[currentLang]?.loading || 'Loading...';
  
  try {
    await apiFetch('/admin/email-settings', {
      method: 'POST',
      body: JSON.stringify({ server, port, user, password })
    });
    saved.classList.remove('hidden');
    setTimeout(() => saved.classList.add('hidden'), 3500);
  } catch(e) {
    toast('Failed to save settings: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// ============================================================================
// ADMIN (USERS)
// ============================================================================

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  const pbody = document.getElementById('pending-tbody');
  const pcard = document.getElementById('pending-approvals-card');
  const pbadge = document.getElementById('pending-count-badge');
  
  tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Loading users...</td></tr>';
  if (pbody) pbody.innerHTML = '<tr><td colspan="5" class="empty-state">Loading...</td></tr>';

  try {
    const users = await apiFetch('/auth/users');
    
    // Split into pending and processed
    const pending = users.filter(u => u.is_verified && !u.is_approved && !u.is_admin);
    const processed = users.filter(u => u.is_approved || u.is_admin || !u.is_verified);

    // Render Pending
    if (pending.length > 0) {
      pcard.classList.remove('hidden');
      pbadge.textContent = pending.length;
      pbadge.classList.remove('hidden');
      pbody.innerHTML = pending.map(u => `
        <tr>
          <td><strong>${esc(u.name || '—')}</strong></td>
          <td>${esc(u.email || '—')}</td>
          <td><span class="badge badge-blue">${esc(u.username)}</span></td>
          <td style="color:var(--text-3); font-size: 0.82rem;">${new Date(u.created_at).toLocaleDateString()}</td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-primary" style="background:#059669;box-shadow:none;" onclick="approveUser(${u.id}, '${esc(u.name || u.username)}')">Approve</button>
              <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id}, '${esc(u.username)}')">Reject</button>
            </div>
          </td>
        </tr>
      `).join('');
    } else {
      if(pcard) pcard.classList.add('hidden');
      pbadge.classList.add('hidden');
    }

    // Render All
    if (!processed.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No users found.</td></tr>';
      return;
    }
    const isAr = currentLang === 'ar';
    
    tbody.innerHTML = processed.map(u => {
      let statusHtml = '';
      if (u.is_blocked) statusHtml = '<span class="status-badge status-blocked">Blocked</span>';
      else if (u.is_admin) statusHtml = '<span class="status-badge status-active">Admin</span>';
      else if (u.status === 'active') statusHtml = '<span class="status-badge status-active">Active</span>';
      else if (u.status === 'pending') statusHtml = '<span class="status-badge status-pending">Pending</span>';
      else statusHtml = '<span class="status-badge status-unverified">Unverified</span>';

      const blockBtn = (!u.is_admin && u.id !== currentUser.id) ? 
        (u.is_blocked ? 
          `<button class="action-btn" style="color:var(--green)" onclick="unblockUser(${u.id}, '${esc(u.username)}')" title="Unblock User">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
           </button>` :
          `<button class="action-btn" style="color:var(--amber)" onclick="blockUser(${u.id}, '${esc(u.username)}')" title="Block User">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
           </button>`) : '';

      // Premium Trash Icon
      const trashIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

      return `
      <tr>
        <td>${u.id}</td>
        <td>${esc(u.name || '—')}</td>
        <td><span class="badge ${u.is_admin ? 'badge-violet' : 'badge-blue'}">${esc(u.username)}</span></td>
        <td>${esc(u.email || '—')}</td>
        <td>${statusHtml}</td>
        <td>${u.is_admin ? 'Admin' : 'Instructor'}</td>
        <td>
          <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;${isAr ? 'flex-direction:row;' : 'flex-direction:row-reverse;'}">
          ${u.id === currentUser.id ? `<span class="badge" style="background:var(--bg-3)">You</span>` : `
          <button class="action-btn" style="color:var(--red)" onclick="deleteUser(${u.id}, '${esc(u.username)}')" title="Delete User">${trashIcon}</button>
          ${blockBtn}
          `}
          </div>
        </td>
      </tr>
    `}).join('');
  } catch(e) {
    if(tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:var(--red)">Failed to load users: ${e.message}</td></tr>`;
  }
}

window.approveUser = async function(id, name) {
  try {
    await apiFetch(`/auth/users/${id}/approve`, { method: 'POST' });
    toast(`User ${name} approved and notified.`, 'success');
    loadUsers();
  } catch(e) {
    toast('Approval failed: ' + e.message, 'error');
  }
};

window.blockUser = async function(id, name) {
  const L = translations[currentLang];
  const isAr = currentLang === 'ar';
  const confirmed = await showConfirm(
    isAr ? 'حظر المستخدم المختار' : 'Block User',
    isAr ? `هل أنت متأكد من حظر المستخدم ${name}؟ لن يتمكن من تسجيل الدخول.` : `Are you sure you want to block ${name}? They will lose access.`,
    isAr ? 'حظر' : 'Block',
    'btn-danger'
  );
  if (!confirmed) return;
  try {
    await apiFetch(`/auth/users/${id}/block`, { method: 'POST' });
    toast(`User ${name} blocked.`, 'success');
    loadUsers();
  } catch(e) {
    toast('Action failed: ' + e.message, 'error');
  }
};

window.unblockUser = async function(id, name) {
  const L = translations[currentLang];
  const isAr = currentLang === 'ar';
  const confirmed = await showConfirm(
    isAr ? 'فك حظر المستخدم' : 'Unblock User',
    isAr ? `هل أنت متأكد من فك حظر المستخدم ${name}؟` : `Are you sure you want to unblock ${name}?`,
    isAr ? 'فك الحظر' : 'Unblock',
    'btn-primary'
  );
  if (!confirmed) return;
  try {
    await apiFetch(`/auth/users/${id}/unblock`, { method: 'POST' });
    toast(`User ${name} unblocked.`, 'success');
    loadUsers();
  } catch(e) {
    toast('Action failed: ' + e.message, 'error');
  }
};

window.deleteUser = async function(id, name) {
  const L = translations[currentLang];
  const confirmed = await showConfirm(L.delete_user_title, L.delete_user_confirm.replace('{name}', name), L.confirm_btn);
  if (!confirmed) return;
  try {
    const res = await apiFetch(`/auth/users/${id}/reject`, { method: 'DELETE' }); // changed route mapping to unified reject
    toast(res.message, 'success');
    loadUsers();
  } catch(e) {
    toast('Action failed: ' + e.message, 'error');
  }
};


function updateBreadcrumb(mainKey, sub = null) {
  const bc = document.getElementById('breadcrumb');
  const mainText = translations[currentLang]?.[mainKey] || mainKey;
  bc.innerHTML = sub
    ? `<button class="bc-link" onclick="showCourseList()" data-i18n="${mainKey}">${mainText}</button><span class="bc-sep">›</span><span class="bc-current">${sub}</span>`
    : `<span data-i18n="${mainKey}">${mainText}</span>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   MODALS
══════════════════════════════════════════════════════════════════════════ */

function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

window.showConfirm = (title, message, btnText = 'Delete', btnClass = 'btn-danger') => {
  return new Promise((resolve) => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    
    btnOk.textContent = btnText;
    btnOk.className = `btn ${btnClass}`;

    // Adjust button order based on language
    const footer = document.querySelector('#modal-confirm .modal-footer');
    if (footer) {
      if (currentLang === 'ar') {
        // For RTL, OK button should be on the right (flex-start with row-reverse)
        footer.style.flexDirection = 'row-reverse';
        footer.style.justifyContent = 'flex-start';
      } else {
        // For LTR, OK button should be on the right (flex-end with row)
        footer.style.flexDirection = 'row';
        footer.style.justifyContent = 'flex-end';
      }
    }

    const okHandler = () => {
      closeModal('modal-confirm');
      btnOk.removeEventListener('click', okHandler);
      btnCancel.removeEventListener('click', cancelHandler);
      resolve(true);
    };
    const cancelHandler = () => {
      closeModal('modal-confirm');
      btnOk.removeEventListener('click', okHandler);
      btnCancel.removeEventListener('click', cancelHandler);
      resolve(false);
    };

    btnOk.addEventListener('click', okHandler);
    btnCancel.addEventListener('click', cancelHandler);
    openModal('modal-confirm');
  });
};

/* ══════════════════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════════════════ */

async function loadDashboard() {
  // 1) Show Skeletons
  document.getElementById('dash-courses').innerHTML  = '<div class="skeleton skeleton-val"></div>';
  document.getElementById('dash-students').innerHTML = '<div class="skeleton skeleton-val"></div>';
  document.getElementById('dash-sessions').innerHTML = '<div class="skeleton skeleton-val"></div>';
  document.getElementById('dash-rate').innerHTML     = '<div class="skeleton skeleton-val"></div>';

  const tbody = document.getElementById('dash-course-tbody');
  tbody.innerHTML = Array(3).fill(`
    <tr class="skeleton-row">
      <td><div class="skeleton skeleton-cell" style="width:120px"></div></td>
      <td><div class="skeleton skeleton-cell" style="width:60px"></div></td>
      <td><div class="skeleton skeleton-cell" style="width:40px"></div></td>
      <td><div class="skeleton skeleton-cell" style="width:40px"></div></td>
      <td><div class="skeleton skeleton-cell" style="width:80px"></div></td>
      <td><div class="skeleton skeleton-cell" style="width:140px"></div></td>
    </tr>`).join('');

  try {
    const data = await apiFetch('/dashboard');
    document.getElementById('dash-courses').textContent  = data.total_courses;
    document.getElementById('dash-students').textContent = data.total_students;
    document.getElementById('dash-sessions').textContent = data.total_sessions;
    document.getElementById('dash-rate').textContent     = `${data.overall_attendance_rate}%`;

    if (!data.course_stats.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No courses yet.</td></tr>'; return;
    }
    tbody.innerHTML = data.course_stats.map(c => `
      <tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td><span class="badge badge-blue">${c.code}</span></td>
        <td>${c.student_count}</td>
        <td>${c.session_count}</td>
        <td style="color:${rateColor(c.attendance_rate)}">${c.attendance_rate}%</td>
        <td style="min-width:180px">${progressHtml(c.attendance_rate)}</td>
      </tr>`).join('');
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════════════════════════════════════════════════════════════════════════
   COURSES  — LIST
══════════════════════════════════════════════════════════════════════════ */

function showCourseList() {
  document.getElementById('panel-courses-list').classList.remove('hidden');
  document.getElementById('panel-course-detail').classList.add('hidden');
  updateBreadcrumb('courses');
  loadCourses();
}

function showCourseDetail(courseId) {
  document.getElementById('panel-courses-list').classList.add('hidden');
  document.getElementById('panel-course-detail').classList.remove('hidden');
  openCourseDetail(courseId);
}

async function loadCourses() {
  const grid = document.getElementById('course-grid');
  const L = translations[currentLang];
  grid.innerHTML = `<div class="empty-state-card">${L.loading}</div>`;
  try {
    const courses = await apiFetch('/courses');
    if (!courses.length) {
      grid.innerHTML = `<div class="empty-state-card">${L.courses_subtitle}</div>`;
      return;
    }
    grid.innerHTML = courses.map(c => {
      coursesCache[c.id] = c;
      const studentLabel = L.student_count.replace('{n}', c.student_count);
      return `
      <div class="course-card" data-id="${c.id}" role="button" tabindex="0">
        <div class="course-card-header">
          <span class="course-card-code">${c.code}</span>
          <div class="course-card-chevron">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
        <div class="course-card-name">${esc(c.name)}</div>
        <div class="course-card-meta">
          <div class="course-card-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            ${studentLabel}
          </div>
        </div>
      </div>
    `;}).join('');

    document.querySelectorAll('.course-card').forEach(card => {
      card.addEventListener('click',   () => showCourseDetail(+card.dataset.id));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') showCourseDetail(+card.dataset.id); });
    });
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════════════════════════════════════════════════════════════════════════
   COURSE DETAIL
══════════════════════════════════════════════════════════════════════════ */

async function openCourseDetail(courseId) {
  currentCourseId   = courseId;
  currentSessionId  = null;
  sessionRecords    = [];
  warningsMap       = {};
  window.currentCourseSessions = [];

  const cachedData = coursesCache[courseId];
  if (cachedData) {
    currentCourseData = cachedData;
    renderCourseHeader(cachedData);
  }

  try {
    const refreshTask = apiFetch(`/courses/${courseId}`).then(data => {
      currentCourseData = data;
      coursesCache[courseId] = data;
      renderCourseHeader(data);
      fillCourseSettings(data);
    });

    const sessionTask = loadSessions(courseId);
    const warningTask = loadWarnings(courseId);
    const quizTask    = loadQuizzes(courseId);
    const quizSumTask = loadQuizSummary(courseId);

    // Open sessions tab by default
    switchDetailTab('dtab-sessions');

    Promise.all([refreshTask, sessionTask, warningTask, quizTask, quizSumTask]).catch(e => console.error(e));

  } catch (e) { toast(e.message, 'error'); }
}

function renderCourseHeader(data) {
  document.getElementById('detail-course-name-h').textContent     = data.name;
  document.getElementById('detail-course-code-badge').textContent = data.code;
  updateBreadcrumb('courses', `${data.code} — ${data.name}`);
}

function fillCourseSettings(data) {
  document.getElementById('settings-course-name').value = data.name;
  document.getElementById('settings-course-code').value = data.code;
  document.getElementById('s-warn1-lec').value           = data.warn1_lec;
  document.getElementById('s-warn2-lec').value           = data.warn2_lec;
  document.getElementById('s-deprive-lec').value         = data.deprive_lec;

  const w1s = document.getElementById('s-warn1-sec');
  const w2s = document.getElementById('s-warn2-sec');
  const deps = document.getElementById('s-deprive-sec');
  if (w1s) w1s.value = data.warn1_lec;
  if (w2s) w2s.value = data.warn2_lec;
  if (deps) deps.value = data.deprive_lec;

  document.getElementById('s-lec-weight').value = data.lec_weight ?? 1;
  document.getElementById('s-sec-weight').value = data.sec_weight ?? 1;

  // Attendance Grade
  const attToggle = document.getElementById('s-att-grade-enabled');
  if (attToggle) attToggle.checked = data.att_grade_enabled || false;
  const attMax = document.getElementById('s-att-grade-max');
  if (attMax) attMax.value = data.att_grade_max ?? 10.0;
  const attDed = document.getElementById('s-att-grade-deduction');
  if (attDed) attDed.value = data.att_grade_deduction ?? 1.0;
  
  if (typeof updateFormulaPreview === 'function') updateFormulaPreview();
  if (typeof updateAttGradePreview === 'function') updateAttGradePreview();
  if (typeof toggleAttGradeFields === 'function') toggleAttGradeFields();

  document.getElementById('settings-error').classList.add('hidden');
  document.getElementById('settings-saved').classList.add('hidden');
  const ts = document.getElementById('thresh-saved');
  if (ts) ts.classList.add('hidden');

  document.getElementById('roster-tbody').innerHTML      = '<tr><td colspan="6" class="empty-state">Loading roster…</td></tr>';
  document.getElementById('att-summary-chips').innerHTML = '';
  document.getElementById('att-roster-title').textContent = 'Roster';
  document.getElementById('quick-feedback').innerHTML    = '';

  document.getElementById('panel-session-roster').classList.add('hidden');
  document.querySelector('.detail-tabs').classList.remove('hidden');
}

/* Detail tabs */
function switchDetailTab(tabId) {
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dtab-content').forEach(c => {
    c.classList.remove('active');
    c.classList.add('hidden');
  });

  const btn = document.querySelector(`.detail-tab[data-dtab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const activeContent = document.getElementById(tabId);
  if (activeContent) {
    activeContent.classList.add('active');
    activeContent.classList.remove('hidden');
  }

  if (tabId === 'dtab-students') {
    loadEnrolledStudents(currentCourseId);
    loadEnrollableStudents(currentCourseId);
    switchStudentSubTab('stab-enrolled');
  } else if (tabId === 'dtab-sessions') {
    loadSessions(currentCourseId);
  } else if (tabId === 'dtab-quizzes') {
    loadQuizzes(currentCourseId);
    loadQuizSummary(currentCourseId);
  }
}

function switchStudentSubTab(tabId) {
  document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.stab-content').forEach(c => c.classList.remove('active'));
  const btn = document.querySelector(`.sub-tab[data-stab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const el = document.getElementById(tabId);
  if (el) el.classList.add('active');

  if (tabId === 'stab-groups') {
    loadSavedGroups();
  }
}

function loadSavedGroups() {
  if (!currentCourseId) return;
  const saved = localStorage.getItem(`groups_${currentCourseId}`);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      document.getElementById('input-group-count').value = data.count || 2;
      renderGroups(data.groups);
      document.getElementById('groups-export-actions').classList.remove('hidden');
    } catch (e) {
      console.error('Failed to load saved groups', e);
    }
  } else {
    // Reset to default state if no saved data
    const container = document.getElementById('groups-container');
    if (container) {
      container.innerHTML = `<div class="empty-state" data-i18n="no_groups_yet">${translations[currentLang].no_groups_yet}</div>`;
    }
    document.getElementById('groups-export-actions')?.classList.add('hidden');
  }
}

function renderGroups(groups) {
  const container = document.getElementById('groups-container');
  if (!container) return;
  const L = translations[currentLang];
  container.innerHTML = '';
  
  groups.forEach((group, idx) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    
    let html = `
      <div class="group-header">
        <span class="group-title">${L.group_label} ${idx + 1}</span>
        <span class="group-count">${group.length} ${L.student_count_suffix}</span>
      </div>
      <div class="group-student-list">`;
    
    group.forEach(s => {
      html += `
        <div class="group-student-item">
          <span class="group-student-id">${s.student_id}</span>
          <span class="group-student-name">${esc(s.name)}</span>
        </div>`;
    });
    
    html += `</div>`;
    card.innerHTML = html;
    container.appendChild(card);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   WARNINGS
══════════════════════════════════════════════════════════════════════════ */

async function loadWarnings(courseId) {
  try {
    const data = await apiFetch(`/courses/${courseId}/warnings`);
    warningsMap = {};
    data.students.forEach(s => { warningsMap[s.student_id] = s; });
  } catch (_) {}
}

/* ══════════════════════════════════════════════════════════════════════════
   SETTINGS TAB
══════════════════════════════════════════════════════════════════════════ */

function updateFormulaPreview() {
  const lw = parseFloat(document.getElementById('s-lec-weight').value) || 1;
  const sw = parseFloat(document.getElementById('s-sec-weight').value) || 1;
  const el = document.getElementById('weight-formula-preview');
  if (el) {
    let t = translations[currentLang]['score_formula'];
    t = t.replace('{lw}', lw).replace('{sw}', sw);
    el.textContent = t;
  }
}

function updateAttGradePreview() {
  const maxM = parseFloat(document.getElementById('s-att-grade-max')?.value) || 10;
  const ded = parseFloat(document.getElementById('s-att-grade-deduction')?.value) || 1;
  
  const el = document.getElementById('att-grade-formula-preview');
  if (el) {
    el.textContent = `Grade = ${maxM} − (absences × ${ded}) → e.g. 2 absences = ${Math.max(0, maxM - (2 * ded))}/${maxM}`;
  }
  
  const scaleEl = document.getElementById('att-grade-scale-preview');
  if (scaleEl) {
    let html = '';
    for (let i = 0; i <= 6; i++) {
      let mark = Math.max(0, maxM - (i * ded));
      html += `<div>${i} abs. → ${mark}/${maxM}</div>`;
      if (mark === 0) break;
    }
    scaleEl.innerHTML = html;
  }
}

function toggleAttGradeFields() {
  const chk = document.getElementById('s-att-grade-enabled');
  const flds = document.getElementById('att-grade-config-fields');
  if (chk && flds) {
    if (chk.checked) {
      flds.classList.remove('hidden');
    } else {
      flds.classList.add('hidden');
    }
  }
}

function showSaved(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

/* ══════════════════════════════════════════════════════════════════════════
   STUDENTS TAB — Enrolled
══════════════════════════════════════════════════════════════════════════ */

let currentEnrollments = [];
async function loadEnrolledStudents(courseId) {
  const tbody = document.getElementById('enrolled-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Loading…</td></tr>';
  try {
    const enrollments = await apiFetch(`/courses/${courseId}/students`);
    await loadWarnings(warningsMap); // Pass warningsMap to loadWarnings
    currentEnrollments = enrollments;
    renderEnrolledList(document.getElementById('enrolled-search').value);
  } catch (e) { toast(e.message, 'error'); }
}

function renderEnrolledList(search = '') {
  const tbody = document.getElementById('enrolled-tbody');
  if (!currentEnrollments.length) {
    const msg = translations[currentLang]['no_students_enrolled'];
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${msg}</td></tr>`;
    return;
  }
  const f = currentEnrollments.filter(e =>
    e.student.student_id.toLowerCase().includes(search.toLowerCase()) ||
    e.student.name.toLowerCase().includes(search.toLowerCase())
  );
  if (!f.length) {
    const msg = translations[currentLang]['no_matching_students'];
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">${msg}</td></tr>`;
    return;
  }
  tbody.innerHTML = f.map(e => {
    const w   = warningsMap[e.student.student_id] || {};
    const lvl = w.overall_level ?? 0;
    const la  = w.lec_absent != null ? `${w.lec_absent}/${w.lec_total ?? '?'}` : '—';
    const sa  = w.sec_absent != null ? `${w.sec_absent}/${w.sec_total ?? '?'}` : '—';
    return `<tr>
      <td><code>${esc(e.student.student_id)}</code></td>
      <td class="name-align">${esc(e.student.name)}</td>
      <td class="center">${la}</td>
      <td class="center">${sa}</td>
      <td>${progressHtml(e.attendance_rate)}</td>
      <td>${warnBadge(lvl)}</td>
      <td>
        <button type="button" class="btn btn-danger btn-sm btn-icon" title="Unenroll"
          onclick="unenrollStudent(event, ${currentCourseId}, ${e.student.id})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="8"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

window.unenrollStudent = async function(e, courseId, studentDbId) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const L = translations[currentLang];
  const confirmed = await showConfirm(L.unenroll_title, L.unenroll_confirm, L.confirm_btn);
  if (!confirmed) return;
  try {
    await apiFetch(`/courses/${courseId}/enroll/${studentDbId}`, { method: 'DELETE' });
    toast(translations[currentLang].student_unenrolled_toast, 'info');
    loadEnrolledStudents(courseId);
    loadEnrollableStudents(courseId);
    await loadWarnings(courseId);
  } catch (e) { toast(e.message, 'error'); }
};

/* ── Enroll tab ────────────────────────────────────────────────────────── */
let allStudents = [], enrolledIds = new Set();

async function loadEnrollableStudents(courseId) {
  try {
    const [students, enrolled] = await Promise.all([
      apiFetch('/students'),
      apiFetch(`/courses/${courseId}/students`),
    ]);
    allStudents = students;
    enrolledIds = new Set(enrolled.map(e => e.student.id));
    renderEnrollList(document.getElementById('enroll-search').value);
  } catch (e) { toast(e.message, 'error'); }
}

function renderEnrollList(search = '') {
  const tbody = document.getElementById('enroll-tbody');
  const f = allStudents.filter(s =>
    !enrolledIds.has(s.id) &&
    (s.student_id.toLowerCase().includes(search.toLowerCase()) ||
     s.name.toLowerCase().includes(search.toLowerCase()))
  );
  tbody.innerHTML = f.length
    ? f.map(s => `<tr>
        <td><input type="checkbox" class="enroll-check" value="${s.id}" /></td>
        <td><code>${esc(s.student_id)}</code></td>
        <td>${esc(s.name)}</td>
      </tr>`).join('')
    : '<tr><td colspan="3" class="empty-state">No students to enroll.</td></tr>';
}

async function handleImport(file) {
  if (!file.name.endsWith('.xlsx')) { toast('Only .xlsx files accepted.', 'error'); return; }
  const resultsEl = document.getElementById('import-results');
  resultsEl.classList.add('hidden');
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res  = await fetch(`${API}/courses/${currentCourseId}/import`, { method: 'POST', body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Import failed.');
    let html = `
      <div class="import-result-row"><span>✅ New students added</span><strong>${json.success}</strong></div>
      <div class="import-result-row"><span>⏩ Duplicates skipped</span><strong>${json.skipped_duplicate}</strong></div>
      <div class="import-result-row"><span>🔗 Enrolled in course</span><strong>${json.enrolled}</strong></div>`;
    if (json.failed?.length)
      html += `<div class="import-result-row"><span>❌ Failed rows</span><strong>${json.failed.length}</strong></div>
        <div class="fail-list">${json.failed.map(f => `Row ${f.row}: ${f.reason}`).join('<br/>')}</div>`;
    resultsEl.innerHTML = html;
    resultsEl.classList.remove('hidden');
    toast(`Import done! ${json.success} added, ${json.enrolled} enrolled.`, 'success');
    loadEnrolledStudents(currentCourseId);
    loadEnrollableStudents(currentCourseId);
    await loadWarnings(currentCourseId);
    loadDashboard();
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════════════════════════════════════════════════════════════════════════
   ATTENDANCE TAB  — Sessions
══════════════════════════════════════════════════════════════════════════ */

async function loadSessions(courseId) {
  try {
    const sessions = await apiFetch(`/courses/${courseId}/sessions`);
    sessions.sort((a,b) => new Date(a.session_date) - new Date(b.session_date));
    window.currentCourseSessions = sessions;
    renderSessionsDual(sessions);
  } catch (e) { toast(e.message, 'error'); }
}

function renderSessionsDual(sessions) {
  const container = document.getElementById('sessions-dual-rows');
  if (!sessions.length) {
    container.innerHTML = '<div class="empty-state">No sessions created yet.</div>';
    return;
  }

  const lecs = sessions.filter(s => s.session_type === 'lecture');
  const labs = sessions.filter(s => s.session_type !== 'lecture');

  const maxRows = Math.max(lecs.length, labs.length);
  
  // Calculate relative week based on first session date
  const parseDate = (dStr) => {
    const p = dStr.split('-');
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  };
  const firstDate = parseDate(sessions[0].session_date);
  const getWeek = (dStr) => {
    const diff = Math.floor((parseDate(dStr) - firstDate) / (1000 * 60 * 60 * 24));
    return Math.floor(diff / 7) + 1;
  };
  const wLabel = currentLang === 'ar' ? 'الأسبوع' : 'Week';

  let html = '';

  for (let i = 0; i < maxRows; i++) {
    const l = lecs[i];
    const b = labs[i];
    const lIdx = l ? `${i + 1} (${wLabel} ${getWeek(l.session_date)})` : '';
    const bIdx = b ? `${i + 1} (${wLabel} ${getWeek(b.session_date)})` : '';
    
    html += `<div class="session-dual-pair">`;
    html += renderSessionCell(l, 'Lecture', lIdx);
    html += renderSessionCell(b, labs[i]?.session_type === 'lab' ? 'Lab' : 'Section', bIdx);
    html += `</div>`;
  }
  
  // Add an extra row with 'Add' buttons
  html += `
    <div class="session-dual-pair" style="margin-top: 12px;">
      <div class="session-cell" style="justify-content: center; align-items: center; display: flex; cursor: pointer; border: 1px dashed var(--border); border-radius: 12px; min-height: 80px; background: rgba(0,0,0,0.02);" 
           onclick="const tl = document.getElementById('type-lecture'); if(tl) tl.checked = true; document.getElementById('btn-add-session-direct').click();">
        <div style="color: var(--text-2); font-weight: 500; font-size: 0.95rem; text-align: center;">
           <span style="font-size:1.2rem; display:block; margin-bottom:4px;">+</span> Add Lecture
        </div>
      </div>
      <div class="session-cell" style="justify-content: center; align-items: center; display: flex; cursor: pointer; border: 1px dashed var(--border); border-radius: 12px; min-height: 80px; background: rgba(0,0,0,0.02);" 
           onclick="const ts = document.getElementById('type-section'); if(ts) ts.checked = true; document.getElementById('btn-add-session-direct').click();">
        <div style="color: var(--text-2); font-weight: 500; font-size: 0.95rem; text-align: center;">
           <span style="font-size:1.2rem; display:block; margin-bottom:4px;">+</span> Add Lab / Sec
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function renderSessionCell(s, typeAlt, index) {
  const L = translations[currentLang];
  if (!s) return `<div class="session-cell empty">${L.no_student_data}</div>`;

  const isRecorded = (s.total_count > 0);
  const typeIcon = s.session_type === 'lecture' ? '🎓' : (s.session_type === 'lab' ? '🧪' : '📝');
  const typeName = translations[currentLang][s.session_type] || s.session_type;

  return `
    <div class="session-cell">
      <div class="session-mini-card ${s.cancelled ? 'cancelled' : ''}" id="smc-${s.id}">
        ${s.cancelled ? `<span class="cancelled-label">${translations[currentLang].cancelled}</span>` : ''}
        <div class="smc-top">
          <div>
            <div class="smc-title">${typeIcon} ${typeName} ${index}${s.label ? ' · ' + esc(s.label) : ''}</div>
            <div class="smc-date">${s.session_date}</div>
          </div>
          ${!s.cancelled ? `
          <div class="smc-status ${isRecorded ? 'smc-status--recorded' : 'smc-status--pending'}">
            <span class="smc-status-dot"></span>
            ${isRecorded ? translations[currentLang].recorded : translations[currentLang].not_recorded}
          </div>` : ''}
        </div>
        <div class="smc-stats">
          <div class="smc-stat"><span>${s.present_count}</span> ${translations[currentLang].present}</div>
          <div class="smc-stat"><span>${s.total_count - s.present_count}</span> ${translations[currentLang].absent}</div>
        </div>
        <div class="smc-actions">
          <button class="smc-btn smc-btn--blue" ${s.cancelled ? 'style="opacity:0.3; cursor:not-allowed;"' : `onclick="viewSession(${s.id})"`} title="${L.view_attendance}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="smc-btn" onclick="editSession(${s.id})" title="${L.edit_date_type}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="smc-btn" onclick="toggleCancelSession(${s.id})" title="${s.cancelled ? L.restore_session : L.cancel_session}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </button>
          <button class="smc-btn smc-btn--danger" onclick="deleteSession(${s.id})" title="${L.delete_permanently}">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
          ${s.quiz_id ? `
          <button class="smc-btn smc-btn--violet" onclick="viewQuiz(${s.quiz_id}, 'sessions')" title="${L.open_linked_quiz}">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
               <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
             </svg>
          </button>` : ''}
        </div>
      </div>
    </div>`;
}

/* Global session actions (called from inline onclick in HTML) */
window.viewSession = async (id) => {
  // Check if session is cancelled before proceeding
  const smc = document.getElementById(`smc-${id}`);
  if (smc && smc.classList.contains('cancelled')) return;

  currentSessionId = id;
  document.querySelector('.detail-tabs').classList.add('hidden');
  document.querySelectorAll('.dtab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById('panel-session-roster').classList.remove('hidden');
  await loadRoster(id);
  document.getElementById('quick-id-input').focus();
};

window.editSession = async (id) => {
  try {
    const data = await apiFetch(`/sessions/${id}`);
    const s = data.session;
    document.getElementById('input-edit-session-id').value = s.id;
    document.getElementById('input-edit-session-date').value = s.session_date;
    document.getElementById('input-edit-session-label').value = s.label || '';
    const r = document.querySelector(`input[name="edit-session-type"][value="${s.session_type}"]`);
    if (r) r.checked = true;

    // Reset Quick Quiz state
    const addToggle = document.getElementById('input-edit-session-add-quiz');
    addToggle.checked = false;
    document.getElementById('edit-session-quiz-fields').classList.add('hidden');
    document.getElementById('edit-session-quiz-new-row').classList.remove('hidden');
    document.getElementById('edit-session-quiz-info').classList.add('hidden');

    // Check if quiz exists
    if (data.quiz) {
       document.getElementById('edit-session-quiz-new-row').classList.add('hidden');
       document.getElementById('edit-session-quiz-info').classList.remove('hidden');
    }

    document.getElementById('edit-session-modal-error').classList.add('hidden');
    openModal('modal-edit-session');
  } catch (e) { toast(e.message, 'error'); }
};

window.deleteSession = async (id) => {
  const L = translations[currentLang];
  const confirmed = await showConfirm(L.delete_session_title, L.delete_session_confirm, L.confirm_btn);
  if (!confirmed) return;
  try {
    await apiFetch(`/sessions/${id}`, { method: 'DELETE' });
    toast('Session deleted.', 'info');
    if (currentSessionId === id) {
      currentSessionId = null;
      document.getElementById('roster-tbody').innerHTML = '<tr><td colspan="6" class="empty-state">Select a session.</td></tr>';
    }
    loadSessions(currentCourseId);
    loadWarnings(currentCourseId);
  } catch (e) { toast(e.message, 'error'); }
};

window.toggleCancelSession = async (id) => {
  try {
    const s = await apiFetch(`/sessions/${id}/cancel`, { method: 'PUT' });
    toast(s.cancelled ? 'Session cancelled. (Excluded from warnings)' : 'Session restored.', 'info');
    loadSessions(currentCourseId);
    loadWarnings(currentCourseId);
  } catch (e) { toast(e.message, 'error'); }
};

function updateRosterBadges(type) {
  document.getElementById('roster-badge-lec').style.display = type === 'lecture' ? 'inline-block' : 'none';
  document.getElementById('roster-badge-sec').style.display = type === 'section' ? 'inline-block' : 'none';
  document.getElementById('roster-badge-lab').style.display = type === 'lab'     ? 'inline-block' : 'none';
}

/* ══════════════════════════════════════════════════════════════════════════
   ROSTER
══════════════════════════════════════════════════════════════════════════ */

async function loadRoster(sessionId) {
  document.getElementById('roster-tbody').innerHTML =
    '<tr><td colspan="6" class="empty-state">Loading…</td></tr>';
  try {
    const data = await apiFetch(`/sessions/${sessionId}`);
    await loadWarnings(currentCourseId);
    sessionRecords = data.records;
    const s = data.session;
    currentSessionType = s.session_type;

    updateRosterBadges(s.session_type);

    const typeLabel = s.session_type === 'lecture' ? '🎓 Lecture' : (s.session_type === 'lab' ? '🧪 Lab' : '📝 Section');
    document.getElementById('att-roster-title').textContent =
      `${typeLabel} · ${s.session_date}${s.label ? ' · ' + s.label : ''}`;
    renderRoster(document.getElementById('roster-search').value);
  } catch (e) { toast(e.message, 'error'); }
}

function renderRoster(search = '') {
  const tbody   = document.getElementById('roster-tbody');
  const chipsEl = document.getElementById('att-summary-chips');

  const filtered = search
    ? sessionRecords.filter(r =>
        r.student_id.toLowerCase().includes(search.toLowerCase()) ||
        r.student_name.toLowerCase().includes(search.toLowerCase()))
    : sessionRecords;

  const L = translations[currentLang];
  const present = sessionRecords.filter(r => r.status === 'present').length;
  chipsEl.innerHTML = `
    <span class="chip chip-present">✓ ${present} ${L.present_chip}</span>
    <span class="chip chip-absent">✗ ${sessionRecords.length - present} ${L.absent_chip}</span>`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${L.no_students_found}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const w   = warningsMap[r.student_id] || {};
    const lvl = w.overall_level ?? 0;
    const la  = w.lec_absent != null ? `${w.lec_absent}` : '—';
    const sa  = w.sec_absent != null ? `${w.sec_absent}` : '—';
    return `<tr id="record-row-${r.record_id}">
      <td><code>${esc(r.student_id)}</code></td>
      <td class="name-align">${esc(r.student_name)}</td>
      <td>
        <button class="toggle-btn toggle-${r.status}"
          onclick="toggleRecord(${r.record_id},'${r.status}')">
          ${r.status === 'present' ? '✓ ' + L.present : '✗ ' + L.absent}
        </button>
      </td>
      <td class="center">${la}</td>
      <td class="center">${sa}</td>
      <td>${warnBadge(lvl)}</td>
    </tr>`;
  }).join('');
}

window.toggleRecord = async function(recordId, currentStatus) {
  const newStatus = currentStatus === 'present' ? 'absent' : 'present';
  try {
    await apiFetch(`/sessions/${currentSessionId}/records/${recordId}`, {
      method: 'PUT', body: JSON.stringify({ status: newStatus }),
    });
    const rec = sessionRecords.find(r => r.record_id === recordId);
    if (rec) rec.status = newStatus;
    renderRoster(document.getElementById('roster-search').value);
    loadWarnings(currentCourseId).then(() =>
      renderRoster(document.getElementById('roster-search').value));
  } catch (e) { toast(e.message, 'error'); }
};

async function bulkMark(status) {
  if (!currentSessionId) return;
  try {
    const res = await apiFetch(`/sessions/${currentSessionId}/bulk-records`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    sessionRecords.forEach(r => r.status = status);
    await loadWarnings(currentCourseId);
    renderRoster(document.getElementById('roster-search').value);
    const L = translations[currentLang];
    toast(L.all_marked_as.replace('{status}', status), 'success');
  } catch (e) { toast(e.message, 'error'); }
}

/* ══════════════════════════════════════════════════════════════════════════
   QUICK MARK
══════════════════════════════════════════════════════════════════════════ */

let feedbackTimer;

function showFeedback(msg, cls) {
  const fb = document.getElementById('quick-feedback');
  if (!fb) return;
  fb.innerHTML = `<span class="${cls}">${msg}</span>`;
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { if (fb) fb.innerHTML = ''; }, 4000);
}

window.doQuickMark = async function() {
  const input = document.getElementById('quick-id-input');
  const btn = document.getElementById('btn-quick-submit');
  if (!input) return;

  const val = input.value.trim();
  if (!val) return;

  if (!currentSessionId) {
    const L = translations[currentLang];
    toast(`⚠ ${L.no_session_selected}`, 'warning');
    showFeedback(`⚠ ${L.select_session_first}`, 'feedback-warning');
    return;
  }

  // OPTIMISTIC UPDATE: Immediate visual feedback
  input.classList.add('busy');
  if (btn) btn.classList.add('busy');
  showFeedback('Marking...', 'feedback-warning');

  // Try to find student in current loaded roster 
  const rec = sessionRecords.find(r => r.student_id === val);
  const wasPresent = rec && rec.status === 'present';
  
  if (rec && !wasPresent) {
      rec.status = 'present'; 
      // Re-render quickly
      const searchVal = document.getElementById('roster-search')?.value || '';
      renderRoster(searchVal);
  }

  try {
    const res = await apiFetch(`/sessions/${currentSessionId}/quick-mark`, {
      method: 'POST',
      body: JSON.stringify({ student_id: val }),
    });

    if (res.already_marked) {
      showFeedback(res.message, 'feedback-warning');
    } else {
      showFeedback(res.message, 'feedback-success');

      // If we didn't find the rec early (e.g. wasn't loaded?), ensure the state is updated
      const serverRec = sessionRecords.find(r => r.student_id === res.student.student_id);
      if (serverRec) serverRec.status = 'present';
      
      // Background load of warnings (non-blocking for UI response)
      loadWarnings(currentCourseId).then(() => {
        const searchVal = document.getElementById('roster-search')?.value || '';
        renderRoster(searchVal);
      });
    }

    input.value = '';
    input.focus();

  } catch (e) {
    showFeedback(`✗ ${e.message}`, 'feedback-error');
    toast(`Error: ${e.message}`, 'error');

    // Rollback the optimistic update on error
    if (rec && !wasPresent) {
       rec.status = 'absent';
       const searchVal = document.getElementById('roster-search')?.value || '';
       renderRoster(searchVal);
    }
    input.select();
  } finally {
      input.classList.remove('busy');
      if (btn) btn.classList.remove('busy');
  }
};

/* ══════════════════════════════════════════════════════════════════════════
   ALL EVENT LISTENERS — safe checks to prevent null crashes
══════════════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════════════════
   QUIZZES
══════════════════════════════════════════════════════════════════════════ */

let currentQuizId = null;
let currentQuizGrades = [];
let quizSummaryData = { quizzes: [], students: [] }; // Store summary data
let quizRosterData = { quiz: {}, grades: [] }; // Store roster data

async function loadQuizzes(courseId) {
  const grid = document.getElementById('quizzes-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="empty-state">Loading quizzes…</div>';
  try {
    const L = translations[currentLang];
    const quizzes = await apiFetch(`/courses/${courseId}/quizzes`);
    if (!quizzes.length) {
      grid.innerHTML = `<div class="empty-state">${L.no_quizzes}</div>`;
    } else {
      grid.innerHTML = quizzes.map(q => `
        <div class="quiz-card" onclick="viewQuiz(${q.id})">
          <div class="quiz-card-header">
            <div class="quiz-card-name">
              ${q.use_as_attendance ? '<span class="badge badge-present" style="font-size:0.6rem; padding:1px 4px; vertical-align:middle; margin-right:4px;">ATT</span>' : ''}
              ${esc(q.name)}
            </div>
            <div class="quiz-card-actions">
               <button class="btn btn-ghost btn-sm btn-icon" onclick="event.stopPropagation(); editQuiz(${q.id})">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
               </button>
               <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation(); deleteQuiz(${q.id})">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
               </button>
            </div>
          </div>
          <div class="quiz-card-meta">
            <div class="quiz-card-meta-item"><span>📅</span> ${q.quiz_date}</div>
            <div class="quiz-card-meta-item"><span>💯</span> ${L.max_score}: ${q.max_score}</div>
            ${q.notes ? `<div class="quiz-card-meta-item"><span>📝</span> ${esc(q.notes)}</div>` : ''}
            ${q.quiz_file ? `<div class="quiz-card-meta-item"><span>📎</span> ${L.resource_attached}</div>` : ''}
          </div>
        </div>
      `).join('');
    }
  } catch (e) { console.error(e); }
}

function renderQuizSummary(search = '') {
  const thead = document.getElementById('quiz-summary-thead');
  const tbody = document.getElementById('quiz-summary-tbody');
  if (!thead || !tbody) return;
  const L = translations[currentLang];
  const hasAttGrade = quizSummaryData.att_grade_enabled;

  // Build Header (rebuild to handle toggling)
  let headHtml = `<tr><th class="id-col">${L.table_id}</th><th class="name-col">${L.table_name}</th>`;
  quizSummaryData.quizzes.forEach(q => {
     headHtml += `<th class="center score-col" title="${esc(q.name)}">${esc(q.name)} <small>/${q.max_score}</small></th>`;
  });
  
  headHtml += `<th class="center score-col score-total">Quiz Total</th>`;
  
  if (hasAttGrade) {
     headHtml += `<th class="center score-col att-grade-col" style="background-color: var(--green-dim); color: var(--green);">Attendance <small>/${quizSummaryData.att_grade_max}</small></th>`;
     headHtml += `<th class="center score-col score-total">Final Total</th></tr>`;
  } else {
     headHtml += `</tr>`;
  }
  thead.innerHTML = headHtml;
  
  // Build Body
  if (!quizSummaryData.students.length) {
     tbody.innerHTML = `<tr><td colspan="${quizSummaryData.quizzes.length + (hasAttGrade ? 5 : 3)}" class="empty-state">${L.no_student_data}</td></tr>`;
     return;
  }
  
  const filtered = quizSummaryData.students.filter(s => 
    s.student_id.toLowerCase().includes(search.toLowerCase()) ||
    s.student_name.toLowerCase().includes(search.toLowerCase())
  );
  
  tbody.innerHTML = filtered.map(s => {
    let rowHtml = `
    <tr>
      <td class="id-col"><code>${esc(s.student_id)}</code></td>
      <td class="name-col name-align">${esc(s.student_name)}</td>`;
      
    s.grades.forEach(g => {
       rowHtml += `<td class="center score-col">${g.score}</td>`;
    });
    
    rowHtml += `<td class="center score-col score-total"><strong>${s.total_score}</strong></td>`;
    
    if (hasAttGrade) {
       rowHtml += `<td class="center score-col att-grade-col" style="background-color: var(--green-dim); color: var(--green);">${s.attendance_grade}</td>`;
       rowHtml += `<td class="center score-col score-total"><strong>${s.final_total}</strong></td>`;
    }
    rowHtml += `</tr>`;
    return rowHtml;
  }).join('');
}

async function loadQuizSummary(courseId) {
  try {
    const data = await apiFetch(`/courses/${courseId}/quizzes/summary`);
    quizSummaryData = data; // Store the fetched data
    renderQuizSummary(document.getElementById('quiz-summary-search')?.value || '');
  } catch (e) { console.error(e); }
}

window.viewQuiz = async (id, source = 'quizzes') => {
  currentQuizId = id;
  quizBackSource = source;
  const backBtn = document.getElementById('btn-quiz-back');
  const backLabel = document.getElementById('quiz-back-label');
  const L = translations[currentLang];
  if (backLabel) backLabel.textContent = source === 'sessions' ? L.sessions_back : L.quiz_back;
  
  const tabs = document.querySelector('.detail-tabs');
  if (tabs) tabs.classList.add('hidden');
  document.querySelectorAll('.dtab-content').forEach(c => c.classList.add('hidden'));
  const panel = document.getElementById('panel-quiz-detail');
  if (panel) panel.classList.remove('hidden');
  
  const idIn = document.getElementById('quick-quiz-id-input');
  const grIn = document.getElementById('quick-quiz-grade-input');
  if (idIn) idIn.value = '';
  if (grIn) grIn.value = '';
  const feed = document.getElementById('quick-grade-feedback');
  if (feed) feed.innerHTML = '';
  
  await loadQuizRoster(id);
  if (idIn) idIn.focus();
};

function renderQuizRoster(search = '') {
  const tbody = document.getElementById('quiz-roster-tbody');
  const L = translations[currentLang];
  const q = quizRosterData.quiz;
  const grades = quizRosterData.grades;

  // Update header info
  document.getElementById('quiz-detail-badge').textContent = q.name;
  document.getElementById('quiz-date-badge').textContent = q.quiz_date;
  document.getElementById('quiz-max-badge').textContent = `${L.quiz_max_label}: ${q.max_score}`;
  document.getElementById('quiz-roster-title').textContent = `${q.name} - ${L.student_list_label}`;

  const attBadge = document.getElementById('quiz-detail-attendance-badge');
  if (attBadge) attBadge.style.display = q.use_as_attendance ? 'inline-block' : 'none';

  const sessCard = document.getElementById('quiz-session-info-card');
  const sessVal = document.getElementById('quiz-session-value');
  if (sessCard && sessVal) {
    if (quizRosterData.session_label) {
      sessCard.style.display = 'block';
      sessVal.textContent = quizRosterData.session_label;
    } else {
      sessCard.style.display = 'none';
    }
  }

  const filesCard = document.getElementById('quiz-files-info-card');
  const btnQ = document.getElementById('btn-download-quiz');
  const btnA = document.getElementById('btn-download-answer');
  if (filesCard && btnQ && btnA) {
    const hasFiles = q.quiz_file || q.model_answer_file;
    filesCard.style.display = hasFiles ? 'block' : 'none';
    
    if (q.quiz_file) {
      btnQ.style.display = 'flex';
      btnQ.onclick = () => window.open(`${API}/quizzes/files/${q.quiz_file}`, '_blank');
    } else {
      btnQ.style.display = 'none';
    }

    if (q.model_answer_file) {
      btnA.style.display = 'flex';
      btnA.onclick = () => window.open(`${API}/quizzes/files/${q.model_answer_file}`, '_blank');
    } else {
      btnA.style.display = 'none';
    }
  }

  const total = grades.length;
  const gradedCount = grades.filter(g => g.is_graded).length;
  const pendingCount = total - gradedCount;
  const chipsDiv = document.getElementById('quiz-summary-chips');
  if (chipsDiv) {
    chipsDiv.innerHTML = `
      <span class="chip chip-total">${L.total_label}: ${total}</span>
      <span class="chip chip-present">${L.graded}: ${gradedCount}</span>
      <span class="chip chip-absent">${L.pending}: ${pendingCount}</span>
    `;
  }

  const filtered = grades.filter(g => 
    g.student_id.toLowerCase().includes(search.toLowerCase()) ||
    g.student_name.toLowerCase().includes(search.toLowerCase())
  );
  
  tbody.innerHTML = filtered.map(g => `
    <tr>
      <td><code>${esc(g.student_id)}</code></td>
      <td class="name-align">${esc(g.student_name)}</td>
      <td>
        <div class="table-stepper">
          <input type="number" id="grade-input-${g.grade_id}" class="grade-input" value="${g.score}" step="0.5" min="0" max="${q.max_score}"
            onchange="updateQuizGrade(${q.id}, ${g.grade_id}, this.value)" 
            onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" />
          <div class="custom-stepper">
            <button type="button" class="stepper-btn up" onclick="adjustStep('grade-input-${g.grade_id}', 0.5)">▲</button>
            <button type="button" class="stepper-btn down" onclick="adjustStep('grade-input-${g.grade_id}', -0.5)">▼</button>
          </div>
        </div>
      </td>
      <td>
         ${g.is_graded ? `<span class="badge badge-present">${L.graded}</span>` : `<span class="badge" style="background:var(--bg-3)">${L.pending}</span>`}
      </td>
    </tr>
  `).join('');
}

async function loadQuizRoster(quizId) {
  const tbody = document.getElementById('quiz-roster-tbody');
  const L = translations[currentLang];
  // Only show loading if empty to prevent layout jump
  if (tbody.innerHTML.trim() === '' || tbody.innerText.includes('Loading')) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">${L.loading}</td></tr>`;
  }
  try {
    const data = await apiFetch(`/quizzes/${quizId}`);
    quizRosterData = data; // Store the fetched data
    currentQuizGrades = data.grades; // Keep this for quick-grade logic
    renderQuizRoster(document.getElementById('quiz-roster-search')?.value || '');
    
    // Exports are now handled via events in DOMContentLoaded
    
  } catch (e) { toast(e.message, 'error'); }
}

window.adjustStep = (id, amount) => {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseFloat(el.value) || 0;
  const step = parseFloat(el.step) || 1;
  const min = el.min !== "" ? parseFloat(el.min) : -Infinity;
  const max = el.max !== "" ? parseFloat(el.max) : Infinity;
  
  let next = current + amount;
  if (next < min) next = min;
  if (next > max) next = max;
  
  el.value = next;
  // Trigger onchange for table updates
  const event = new Event('change');
  el.dispatchEvent(event);
};

window.updateQuizGrade = async (quizId, gradeId, score) => {
  try {
    await apiFetch(`/quizzes/${quizId}/grades/${gradeId}`, {
      method: 'PUT',
      body: JSON.stringify({ score: parseFloat(score) })
    });
    toast('Grade updated', 'success');
    // Update the local data for immediate UI reflection
    const gradeIndex = currentQuizGrades.findIndex(g => g.grade_id === gradeId);
    if (gradeIndex !== -1) {
      currentQuizGrades[gradeIndex].score = parseFloat(score);
      currentQuizGrades[gradeIndex].is_graded = true;
    }
    // Re-render to update chips and potentially filtered view
    renderQuizRoster(document.getElementById('quiz-roster-search')?.value || '');
    loadQuizSummary(currentCourseId); // Refresh summary as well
  } catch (e) { 
    toast(e.message, 'error');
    loadQuizRoster(quizId); // Re-fetch to ensure consistency
  }
};

async function doQuickGrade() {
  const idInput = document.getElementById('quick-quiz-id-input');
  const gradeInput = document.getElementById('quick-quiz-grade-input');
  const feedback = document.getElementById('quick-grade-feedback');
  if (!idInput || !gradeInput || !feedback) return;
  
  const sid = idInput.value.trim();
  const score = gradeInput.value.trim();
  if (!sid || !score) return;
  
  feedback.className = 'quick-feedback';
  feedback.textContent = 'Saving…';
  
  try {
    const res = await apiFetch(`/quizzes/${currentQuizId}/quick-grade`, {
      method: 'POST',
      body: JSON.stringify({ student_id: sid, score: parseFloat(score) })
    });
    
    feedback.className = 'quick-feedback feedback-success';
    feedback.innerHTML = `<span>${res.message}</span>`;
    idInput.value = '';
    gradeInput.value = '';
    idInput.focus();
    loadQuizRoster(currentQuizId);
  } catch (e) {
    feedback.className = 'quick-feedback feedback-error';
    feedback.textContent = e.message;
  }
}

window.editQuiz = async (id) => {
  try {
    const data = await apiFetch(`/quizzes/${id}`);
    const q = data.quiz;
    document.getElementById('input-quiz-id').value = q.id;
    document.getElementById('input-quiz-name').value = q.name;
    document.getElementById('input-quiz-max').value = q.max_score;
    document.getElementById('input-quiz-date').value = q.quiz_date;
    document.getElementById('input-quiz-notes').value = q.notes || '';
    
    await populateQuizSessions(q.session_id);
    document.getElementById('input-quiz-as-attendance').checked = q.use_as_attendance;
    
    // Initial state check for attendance toggle
    updateQuizAttendanceToggle();

    // File status
    updateFileStatus('quiz', q.quiz_file);
    updateFileStatus('answer', q.model_answer_file);

    document.getElementById('modal-quiz-title').textContent = 'Edit Quiz';
    document.getElementById('quiz-modal-error').classList.add('hidden');
    openModal('modal-quiz');
  } catch (e) { toast(e.message, 'error'); }
};

async function populateQuizSessions(selectedId = null) {
  const select = document.getElementById('input-quiz-session');
  if (!select) return;
  try {
    const sessions = await apiFetch(`/courses/${currentCourseId}/sessions`);
    sessions.sort((a,b) => new Date(b.session_date) - new Date(a.session_date));
    
    let html = '<option value="">No Session Linked</option>';
    sessions.forEach(s => {
      const label = `${s.session_type.toUpperCase()} (${s.session_date})${s.label ? ' - ' + s.label : ''}`;
      html += `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${label}</option>`;
    });
    select.innerHTML = html;
  } catch (e) { console.error('Failed to load sessions for quiz modal', e); }
}

function updateFileStatus(type, filename) {
  const statusEl = document.getElementById(`${type}-file-status`);
  const browseBtn = document.getElementById(`btn-browse-${type}-file`);
  if (!statusEl || !browseBtn) return;
  
  if (filename) {
    statusEl.querySelector('.file-name').textContent = filename.split('_').slice(1).join('_') || filename;
    statusEl.classList.remove('hidden');
    browseBtn.classList.add('hidden');
  } else {
    statusEl.classList.add('hidden');
    browseBtn.classList.remove('hidden');
  }
}

function updateQuizAttendanceToggle() {
  const sessionSelect = document.getElementById('input-quiz-session');
  const attendanceToggle = document.getElementById('input-quiz-as-attendance');
  if (!sessionSelect || !attendanceToggle) return;
  
  if (!sessionSelect.value) {
    attendanceToggle.checked = false;
    attendanceToggle.disabled = true;
  } else {
    attendanceToggle.disabled = false;
  }
}

window.deleteQuiz = async (id) => {
  const L = translations[currentLang];
  const confirmed = await showConfirm(L.delete_quiz_title, L.delete_quiz_confirm, L.confirm_btn);
  if (!confirmed) return;
  try {
    await apiFetch(`/quizzes/${id}`, { method: 'DELETE' });
    toast('Quiz deleted');
    loadQuizzes(currentCourseId);
    loadQuizSummary(currentCourseId);
  } catch (e) { toast(e.message, 'error'); }
};

document.addEventListener('DOMContentLoaded', () => {

  const on = (id, evt, cb) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, cb);
  };

  const updateSuggestedSessionDate = (targetType) => {
    if (!currentCourseId) return;
    let nextDateStr = new Date().toISOString().split('T')[0];
    if (window.currentCourseSessions && window.currentCourseSessions.length > 0) {
      // Filter strictly by the chosen type (Lecture, Lab, or Section)
      const sameTypeSessions = window.currentCourseSessions.filter(s => s.session_type === targetType);
      if (sameTypeSessions.length > 0) {
        const maxDateStr = sameTypeSessions[sameTypeSessions.length - 1].session_date;
        const parseDate = (dStr) => {
          const p = dStr.split('-');
          return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
        };
        const d = parseDate(maxDateStr);
        d.setUTCDate(d.getUTCDate() + 7);
        nextDateStr = d.toISOString().split('T')[0];
      } else {
        nextDateStr = window.currentCourseSessions[0].session_date;
      }
    }
    const dateInput = document.getElementById('input-session-date');
    if (dateInput) dateInput.value = nextDateStr;
  };

  // Add listeners for type changes in the modal
  document.querySelectorAll('input[name="session-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) updateSuggestedSessionDate(e.target.value);
    });
  });

  /* ── Navigation ── */
  VIEWS.forEach(v => on(`nav-${v}`, 'click', () => switchView(v)));
  on('menu-toggle', 'click', () => document.getElementById('sidebar').classList.toggle('open'));

  /* ── Modals: close buttons & overlay click ── */
  document.querySelectorAll('[data-close]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(btn.dataset.close)));
  document.querySelectorAll('.modal-overlay').forEach(ov =>
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(ov.id); }));

  /* ── Back button ── */
  on('btn-back-courses', 'click', showCourseList);

  /* ── New Course modal ── */
  on('btn-add-course', 'click', () => {
    document.getElementById('input-course-name').value = '';
    document.getElementById('input-course-code').value = '';
    document.getElementById('course-modal-error').classList.add('hidden');
    openModal('modal-course');
    setTimeout(() => document.getElementById('input-course-name').focus(), 100);
  });

  on('btn-save-course', 'click', async () => {
    const name = document.getElementById('input-course-name').value.trim();
    const code = document.getElementById('input-course-code').value.trim();
    const err  = document.getElementById('course-modal-error');
    err.classList.add('hidden');
    if (!name || !code) { err.textContent = 'Both fields required.'; err.classList.remove('hidden'); return; }
    try {
      await apiFetch('/courses', { method: 'POST', body: JSON.stringify({ name, code }) });
      toast(translations[currentLang].course_created, 'success');
      closeModal('modal-course');
      loadCourses();
      loadDashboard();
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
  });

  ['input-course-name','input-course-code'].forEach(id => {
    on(id, 'keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-save-course').click();
    });
  });

  /* ── Detail tabs ── */
  document.querySelectorAll('.detail-tab').forEach(tab =>
    tab.addEventListener('click', () => switchDetailTab(tab.dataset.dtab)));

  /* ── Student sub-tabs ── */
  document.querySelectorAll('.sub-tab').forEach(t =>
    t.addEventListener('click', () => switchStudentSubTab(t.dataset.stab)));

  /* ── Settings ── */
  on('btn-save-settings', 'click', async () => {
    const name = document.getElementById('settings-course-name').value.trim();
    const code = document.getElementById('settings-course-code').value.trim().toUpperCase();
    const err  = document.getElementById('settings-error');
    err.classList.add('hidden');
    if (!name || !code) { err.textContent = 'Both fields required.'; err.classList.remove('hidden'); return; }
    try {
      const updated = await apiFetch(`/courses/${currentCourseId}`, {
        method: 'PUT', body: JSON.stringify({ name, code }),
      });
      document.getElementById('detail-course-name-h').textContent    = updated.name;
      document.getElementById('detail-course-code-badge').textContent = updated.code;
      updateBreadcrumb('Courses', `${updated.code} — ${updated.name}`);
      currentCourseData = updated;
      showSaved('settings-saved');
      loadDashboard();
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
  });

  on('btn-sync-records', 'click', async () => {
    try {
      const res = await apiFetch(`/courses/${currentCourseId}/sync-records`, { method: 'POST' });
      toast(res.message, 'success');
      loadSessions(currentCourseId);
      loadWarnings(currentCourseId);
      loadQuizSummary(currentCourseId);
      if (currentSessionId) loadRoster(currentSessionId);
      if (currentQuizId) loadQuizRoster(currentQuizId);
    } catch (e) { toast(e.message, 'error'); }
  });

  on('btn-save-thresholds', 'click', async () => {
    const lecW = parseFloat(document.getElementById('s-lec-weight').value) || 1;
    const secW = parseFloat(document.getElementById('s-sec-weight').value) || 1;
    const w1   = +document.getElementById('s-warn1-lec').value;
    const w2   = +document.getElementById('s-warn2-lec').value;
    const dep  = +document.getElementById('s-deprive-lec').value;
    const w1s = document.getElementById('s-warn1-sec');
    const w2s = document.getElementById('s-warn2-sec');
    const deps = document.getElementById('s-deprive-sec');
    if (w1s) w1s.value = w1;
    if (w2s) w2s.value = w2;
    if (deps) deps.value = dep;
    const payload = {
      name: currentCourseData.name,
      code: currentCourseData.code,
      warn1_lec: w1,  warn2_lec: w2,  deprive_lec: dep,
      warn1_sec: w1,  warn2_sec: w2,  deprive_sec: dep,
      lec_weight: lecW,
      sec_weight: secW,
    };
    try {
      const updated = await apiFetch(`/courses/${currentCourseId}`, {
        method: 'PUT', body: JSON.stringify(payload),
      });
      currentCourseData = updated;
      showSaved('thresh-saved');
      await loadWarnings(currentCourseId);
      if (sessionRecords.length) renderRoster(document.getElementById('roster-search').value);
      if (document.getElementById('dtab-students').classList.contains('active'))
        loadEnrolledStudents(currentCourseId);
    } catch (e) { toast(e.message, 'error'); }
  });

  ['s-lec-weight', 's-sec-weight'].forEach(id => {
    on(id, 'input', updateFormulaPreview);
  });

  ['s-att-grade-max', 's-att-grade-deduction'].forEach(id => {
    on(id, 'input', updateAttGradePreview);
  });

  on('s-att-grade-enabled', 'change', () => {
    toggleAttGradeFields();
    updateAttGradePreview();
  });

  on('btn-save-att-grade', 'click', async () => {
    const enabled = document.getElementById('s-att-grade-enabled').checked;
    const maxMark = document.getElementById('s-att-grade-max').value;
    const deduction = document.getElementById('s-att-grade-deduction').value;

    try {
      const updated = await apiFetch(`/courses/${currentCourseId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: currentCourseData.name, // Keep existing required fields
          code: currentCourseData.code,
          att_grade_enabled: enabled,
          att_grade_max: maxMark,
          att_grade_deduction: deduction
        })
      });
      currentCourseData = updated;
      showSaved('att-grade-saved');
      loadQuizSummary(currentCourseId); // Refresh summary with new grade config
    } catch (e) { toast(e.message, 'error'); }
  });

  on('btn-delete-course-detail', 'click', async () => {
    const L = translations[currentLang];
    const confirmed = await showConfirm(L.delete_course_title, L.delete_course_confirm, L.confirm_btn);
    if (!confirmed) return;
    try {
      await apiFetch(`/courses/${currentCourseId}`, { method: 'DELETE' });
      toast('Course deleted.', 'info');
      showCourseList();
      loadDashboard();
    } catch (e) { toast(e.message, 'error'); }
  });

  /* ── Enroll ── */
  on('enroll-search', 'input', e => renderEnrollList(e.target.value));
  on('enroll-search', 'keydown', e => {
    if (e.key === 'Enter') {
      const firstCheck = document.querySelector('#enroll-tbody .enroll-check');
      if (firstCheck) {
        firstCheck.checked = true;
        document.getElementById('btn-enroll-selected').click();
      }
    }
  });
  /* ── Sessions Toggles ── */
  on('input-session-add-quiz', 'change', e => {
     document.getElementById('session-quiz-fields').classList.toggle('hidden', !e.target.checked);
     if (e.target.checked) {
       const label = document.getElementById('input-session-label').value.trim();
       document.getElementById('input-session-quiz-name').value = label ? `${label} Quiz` : 'Session Quiz';
     }
  });
  on('input-edit-session-add-quiz', 'change', e => {
     document.getElementById('edit-session-quiz-fields').classList.toggle('hidden', !e.target.checked);
     if (e.target.checked) {
       const label = document.getElementById('input-edit-session-label').value.trim();
       document.getElementById('input-edit-session-quiz-name').value = label ? `${label} Quiz` : 'Session Quiz';
     }
  });

  on('enroll-check-all', 'change', e =>
    document.querySelectorAll('.enroll-check').forEach(cb => cb.checked = e.target.checked));

  on('btn-enroll-selected', 'click', async () => {
    const ids = [...document.querySelectorAll('.enroll-check:checked')].map(cb => +cb.value);
    if (!ids.length) { toast('Select at least one student.', 'warning'); return; }
    try {
      const res = await apiFetch(`/courses/${currentCourseId}/enroll`, {
        method: 'POST', body: JSON.stringify({ student_ids: ids }),
      });
      toast(`Enrolled ${res.enrolled}, skipped ${res.skipped}.`, 'success');
      loadEnrolledStudents(currentCourseId);
      loadEnrollableStudents(currentCourseId);
      await loadWarnings(currentCourseId);
      document.getElementById('enroll-check-all').checked = false;
    } catch (e) { toast(e.message, 'error'); }
  });

  /* ── Import ── */
  const dropZone  = document.getElementById('import-drop-zone');
  const fileInput = document.getElementById('import-file-input');
  if (dropZone && fileInput) {
    on('btn-browse-file', 'click', e => { e.stopPropagation(); fileInput.click(); });
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault(); dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleImport(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleImport(fileInput.files[0]); });
  }

  /* ── Sheet AI Import ── */
  let parsedAISheetData = null;
  let currentSheetSessions = [];
  let sheetEnrolledIds = new Set();

  on('btn-import-sheet', 'click', async () => {
    if (!currentCourseId) return;
    document.getElementById('modal-import-sheet').classList.remove('hidden');
    document.getElementById('sheet-upload-phase').classList.remove('hidden');
    document.getElementById('sheet-preview-phase').classList.add('hidden');
    document.getElementById('sheet-footer-upload').classList.remove('hidden');
    document.getElementById('sheet-footer-preview').classList.add('hidden');
    document.getElementById('sheet-upload-error').classList.add('hidden');
    document.getElementById('sheet-parsing-loader').classList.add('hidden');
    document.getElementById('input-sheet-file').value = '';
    
    try {
      const sesData = await apiFetch(`/courses/${currentCourseId}/sessions`);
      currentSheetSessions = sesData.sessions || [];
      const resEnroll = await apiFetch(`/courses/${currentCourseId}/students`);
      sheetEnrolledIds = new Set((resEnroll.students || []).map(s => String(s.student_id).trim()));

      // Update Week Dropdown: Find max week and offer +1
      const lecCount = currentSheetSessions.filter(s => s.session_type === 'lecture').length;
      const labCount = currentSheetSessions.filter(s => s.session_type === 'lab' || s.session_type === 'section').length;
      const maxW = Math.max(lecCount, labCount, 1);
      
      const weekSel = document.getElementById('sheet-target-week');
      weekSel.innerHTML = '';
      for(let i=1; i<=Math.max(maxW + 2, 12); i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = `Week ${i}`;
        if (i === maxW + 1) opt.selected = true;
        weekSel.appendChild(opt);
      }
    } catch (e) {}
  });

  function verifySheetSessionExists() {
    const tWeek = parseInt(document.getElementById('sheet-target-week').value) || 1;
    const tType = document.getElementById('sheet-session-type').value;
    const existing = currentSheetSessions.filter(s => s.session_type === tType).sort((a,b) => new Date(a.session_date) - new Date(b.session_date));
    
    if (tWeek <= existing.length) {
      document.getElementById('sheet-existing-session-warning').classList.remove('hidden');
    } else {
      document.getElementById('sheet-existing-session-warning').classList.add('hidden');
    }
  }

  function updateSheetPreviewCounts() {
    if (!parsedAISheetData) return;
    const tType = document.getElementById('sheet-session-type').value;
    let matched = 0, unmatched = 0;
    
    (parsedAISheetData.records || []).forEach(r => {
      const sid = String(r.student_id || '').trim();
      if (!sid) return;
      
      let status = null;
      if (tType === 'lecture') status = r.lecture_status || r.status;
      else status = r.lab_status || r.status;
      
      if (status && status.toLowerCase() === 'present') {
        if (sheetEnrolledIds.has(sid)) matched++;
        else unmatched++;
      }
    });
    
    document.getElementById('sheet-matched-count').textContent = matched;
    document.getElementById('sheet-unmatched-count').textContent = unmatched;
    verifySheetSessionExists();
  }

  on('sheet-target-week', 'change', verifySheetSessionExists);
  on('sheet-session-type', 'change', updateSheetPreviewCounts);

  async function handleSheetFile(file) {
    document.getElementById('sheet-upload-error').classList.add('hidden');
    document.getElementById('sheet-parsing-loader').classList.remove('hidden');
    
    const fd = new FormData();
    fd.append('file', file);
    
    try {
      const res = await fetch(`${API}/courses/${currentCourseId}/parse-sheet`, { method: 'POST', body: fd, headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to parse sheet');
      
      parsedAISheetData = json.data;
      
      document.getElementById('sheet-upload-phase').classList.add('hidden');
      document.getElementById('sheet-preview-phase').classList.remove('hidden');
      document.getElementById('sheet-footer-upload').classList.add('hidden');
      document.getElementById('sheet-footer-preview').classList.remove('hidden');
      
      document.getElementById('sheet-preview-date').textContent = parsedAISheetData.session_date || 'Unknown';
      document.getElementById('sheet-preview-course').textContent = 
        [parsedAISheetData.course_name, parsedAISheetData.course_code].filter(Boolean).join(' - ') || 'Unknown';
        
      if (parsedAISheetData.session_type && ['lecture', 'section', 'lab'].includes(parsedAISheetData.session_type.toLowerCase())) {
        document.getElementById('sheet-session-type').value = parsedAISheetData.session_type.toLowerCase();
      }
      
      updateSheetPreviewCounts();
      
    } catch (e) {
      const el = document.getElementById('sheet-upload-error');
      el.textContent = e.message;
      el.classList.remove('hidden');
    } finally {
      document.getElementById('sheet-parsing-loader').classList.add('hidden');
    }
  }

  const sheetDrop = document.getElementById('sheet-drop-zone');
  const sheetFile = document.getElementById('input-sheet-file');
  if (sheetDrop && sheetFile) {
    on('btn-browse-sheet', 'click', () => sheetFile.click());
    sheetDrop.addEventListener('click', e => { if (e.target !== document.getElementById('btn-browse-sheet')) sheetFile.click()});
    sheetDrop.addEventListener('dragover', e => { e.preventDefault(); sheetDrop.style.background = 'var(--bg-3)'; });
    sheetDrop.addEventListener('dragleave', e => { sheetDrop.style.background = 'transparent'; });
    sheetDrop.addEventListener('drop', e => {
      e.preventDefault(); sheetDrop.style.background = 'transparent';
      if (e.dataTransfer.files[0]) handleSheetFile(e.dataTransfer.files[0]);
    });
    sheetFile.addEventListener('change', () => { if (sheetFile.files[0]) handleSheetFile(sheetFile.files[0]); });
  }

  on('btn-sheet-back', 'click', () => {
    document.getElementById('sheet-upload-phase').classList.remove('hidden');
    document.getElementById('sheet-preview-phase').classList.add('hidden');
    document.getElementById('sheet-footer-upload').classList.remove('hidden');
    document.getElementById('sheet-footer-preview').classList.add('hidden');
    document.getElementById('input-sheet-file').value = '';
  });

  on('btn-save-sheet-import', 'click', async () => {
    if (!parsedAISheetData) return;
    const btn = document.getElementById('btn-save-sheet-import');
    btn.disabled = true;
    
    const payload = {
      target_week: parseInt(document.getElementById('sheet-target-week').value) || 1,
      session_type: document.getElementById('sheet-session-type').value,
      session_date: parsedAISheetData.session_date,
      import_mode: document.getElementById('sheet-import-mode').value,
      records: parsedAISheetData.records || []
    };
    
    try {
      const res = await apiFetch(`/courses/${currentCourseId}/import-attendance-sheet`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      toast(res.message || 'Records imported successfully', 'success');
      document.getElementById('modal-import-sheet').classList.add('hidden');
      loadDualSessions(currentCourseId);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  /* ── Sessions ── */
  on('btn-export-attendance', 'click', () => {
    if (!currentCourseId) return;
    document.getElementById('export-attn-week').value = '';
    openModal('modal-export-attendance-options');
  });

  on('btn-confirm-export-attendance', 'click', () => {
    if (!currentCourseId) return;
    const week = document.getElementById('export-attn-week').value;
    let url = `${API}/courses/${currentCourseId}/export-attendance`;
    if (week && parseInt(week) > 0) {
      url += `?week=${week}`;
    }
    closeModal('modal-export-attendance-options');
    window.location.href = url;
  });

  on('btn-add-session-direct', 'click', () => {
    if (!currentCourseId) return;
    
    let targetType = window.pendingSessionType || 'lecture';
    window.pendingSessionType = null;
    
    // Set the suggested date based on the chosen type
    updateSuggestedSessionDate(targetType);

    document.getElementById('input-session-label').value = '';
    
    if (targetType === 'lecture') {
      const tl = document.getElementById('type-lecture');
      if (tl) tl.checked = true;
    } else if (targetType === 'section') {
      const ts = document.getElementById('type-section');
      if (ts) ts.checked = true;
    } else if (targetType === 'lab') {
      const tlb = document.getElementById('type-lab');
      if (tlb) tlb.checked = true;
    }
    
    // Reset Quiz toggle
    document.getElementById('input-session-add-quiz').checked = false;
    document.getElementById('session-quiz-fields').classList.add('hidden');
    document.getElementById('input-session-quiz-name').value = '';

    document.getElementById('session-modal-error').classList.add('hidden');
    openModal('modal-new-session');
    setTimeout(() => document.getElementById('input-session-label').focus(), 100);
  });

  on('btn-save-session', 'click', async () => {
    const sessionDate  = document.getElementById('input-session-date').value;
    const label        = document.getElementById('input-session-label').value.trim();
    const session_type = document.querySelector('input[name="session-type"]:checked')?.value || 'lecture';
    const err = document.getElementById('session-modal-error');
    err.classList.add('hidden');
    
    // Quiz data
    const addQuiz = document.getElementById('input-session-add-quiz').checked;
    const quizName = document.getElementById('input-session-quiz-name').value.trim();
    const quizMax = document.getElementById('input-session-quiz-max').value;
    const quizAtt = document.getElementById('input-session-quiz-as-attendance').checked;

    if (!sessionDate) { err.textContent = 'Select a date.'; err.classList.remove('hidden'); return; }
    if (addQuiz && !quizName) { err.textContent = 'Enter quiz name.'; err.classList.remove('hidden'); return; }

    try {
      const session = await apiFetch(`/courses/${currentCourseId}/sessions`, {
        method: 'POST', body: JSON.stringify({ session_date: sessionDate, label, session_type }),
      });
      
      // If addQuiz, create the quiz now
      if (addQuiz) {
        const formData = new FormData();
        formData.append('name', quizName);
        formData.append('max_score', quizMax);
        formData.append('quiz_date', sessionDate);
        formData.append('session_id', session.id);
        formData.append('use_as_attendance', quizAtt);
        // Notes could be empty
        formData.append('notes', `Quick quiz for ${label || sessionDate}`);

        await fetch(`${API}/courses/${currentCourseId}/quizzes`, {
          method: 'POST',
          body: formData
        }).then(r => { if(!r.ok) throw new Error('Quiz creation failed.'); });
      }

      let typeDisplay = '🎓 Lecture';
      if (session_type === 'section') typeDisplay = '📝 Section';
      if (session_type === 'lab') typeDisplay = '🧪 Lab';
      toast(translations[currentLang].session_created, 'success');
      
      closeModal('modal-new-session');
      await loadSessions(currentCourseId);
      currentSessionId   = session.id;
      currentSessionType = session.session_type;
      
      // The user requested not to navigate directly into the session after creation
      // await viewSession(session.id);
      // document.getElementById('quick-id-input').focus();
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
  });

  /* ── Edit Session modal ── */
  on('btn-update-session', 'click', async () => {
    const id           = document.getElementById('input-edit-session-id').value;
    const session_date = document.getElementById('input-edit-session-date').value;
    const label        = document.getElementById('input-edit-session-label').value.trim();
    const session_type = document.querySelector('input[name="edit-session-type"]:checked')?.value;
    const err = document.getElementById('edit-session-modal-error');
    err.classList.add('hidden');

    // Quick Quiz data
    const addQuiz = document.getElementById('input-edit-session-add-quiz').checked;
    const quizName = document.getElementById('input-edit-session-quiz-name').value.trim();
    const quizMax = document.getElementById('input-edit-session-quiz-max').value;
    const quizAtt = document.getElementById('input-edit-session-quiz-as-attendance').checked;

    if (addQuiz && !quizName) { err.textContent = 'Enter quiz name.'; err.classList.remove('hidden'); return; }

    try {
      await apiFetch(`/sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ session_date, label, session_type })
      });

      if (addQuiz) {
        const formData = new FormData();
        formData.append('name', quizName);
        formData.append('max_score', quizMax);
        formData.append('quiz_date', session_date);
        formData.append('session_id', id);
        formData.append('use_as_attendance', quizAtt);
        formData.append('notes', `Modified session quiz`);

        await fetch(`${API}/courses/${currentCourseId}/quizzes`, {
          method: 'POST',
          body: formData
        }).then(r => { if(!r.ok) throw new Error('Quiz creation failed.'); });
      }

      toast('Session updated' + (addQuiz ? ' and Quiz added.' : '.'), 'success');
      closeModal('modal-edit-session');
      loadSessions(currentCourseId);
    } catch (e) {
      err.textContent = e.message;
      err.classList.remove('hidden');
    }
  });

  /* ── Roster back ── */
  on('btn-roster-back', 'click', () => {
    document.getElementById('panel-session-roster').classList.add('hidden');
    document.querySelector('.detail-tabs').classList.remove('hidden');
    const activeTabId = document.querySelector('.detail-tab.active')?.dataset.dtab || 'dtab-sessions';
    switchDetailTab(activeTabId);
  });

  /* ── Quick Mark: Enter key + button click ── */
  on('quick-id-input', 'keydown', e => {
    if (e.key === 'Enter') window.doQuickMark();
  });
  on('btn-quick-submit', 'click', () => window.doQuickMark());

  /* ── Roster: All Present / All Absent ── */
  on('btn-mark-all-present', 'click', () => bulkMark('present'));
  on('btn-mark-all-absent', 'click',  () => bulkMark('absent'));

  on('stab-enroll',   'click', () => { loadEnrollableStudents(currentCourseId); });
  
  on('enrolled-search',     'input', e => renderEnrolledList(e.target.value));
  on('roster-search',       'input', e => renderRoster(e.target.value));
  on('quiz-summary-search', 'input', e => renderQuizSummary(e.target.value));
  on('quiz-roster-search',  'input', e => renderQuizRoster(e.target.value));

  /* ── Export ── */
  on('btn-export', 'click', () => {
    if (!currentCourseId) return;
    window.open(`${API}/courses/${currentCourseId}/export`, '_blank');
    toast(translations[currentLang].downloading, 'info');
  });

  /* ── Print 1st Warning ── */
  on('btn-open-warning-modal', 'click', () => {
    document.getElementById('warn-from').value = '';
    document.getElementById('warn-to').value = new Date().toISOString().split('T')[0];
    openModal('modal-warning-doc');
  });

  on('btn-generate-warning-doc', 'click', () => {
    const level = document.getElementById('warn-level').value;
    const sem = document.getElementById('warn-semester').value;
    const year = document.getElementById('warn-year').value;
    const from_d = document.getElementById('warn-from').value;
    const to_d = document.getElementById('warn-to').value;
    const inst = document.getElementById('warn-instructor').value;
    const ta = document.getElementById('warn-ta').value;

    const params = new URLSearchParams({ level, sem, year, from_d, to_d, inst, ta });
    window.open(`${API}/courses/${currentCourseId}/export-warnings?${params.toString()}`, '_blank');
    closeModal('modal-warning-doc');
  });

  /* ── Auth Events ── */
  on('btn-login', 'click', doLogin);
  on('login-password', 'keydown', e => { if (e.key === 'Enter') doLogin(); });
  on('btn-logout', 'click', doLogout);
  
  on('link-to-register', 'click', (e) => { e.preventDefault(); showRegister(); });
  on('link-to-login-from-reg', 'click', (e) => { e.preventDefault(); showLogin(); });
  on('link-forgot-password', 'click', (e) => { e.preventDefault(); showForgot(); });
  on('link-back-login', 'click', (e) => { e.preventDefault(); showLogin(); });
  on('link-otp-back-login', 'click', (e) => { e.preventDefault(); showLogin(); });

  on('reg-password', 'input', e => updatePasswordStrength(e.target.value));
  on('btn-register', 'click', doRegister);
  
  on('btn-verify-otp', 'click', doVerifyOTP);
  on('link-resend-otp', 'click', (e) => { e.preventDefault(); doResendOTP(); });

  // OTP auto-advance
  document.querySelectorAll('.otp-box').forEach((box, idx, arr) => {
    box.addEventListener('input', (e) => {
      box.value = box.value.replace(/[^0-9]/g, '');
      box.classList.toggle('filled', box.value.length > 0);
      if (box.value.length === 1 && idx < arr.length - 1) arr[idx + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        arr[idx - 1].focus();
        arr[idx - 1].value = '';
        arr[idx - 1].classList.remove('filled');
      }
      if (e.key === 'Enter') doVerifyOTP();
    });
    // Support paste
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      if (!text) return;
      for (let i = 0; i < text.length && idx + i < arr.length; i++) {
        arr[idx + i].value = text[i];
        arr[idx + i].classList.add('filled');
        if (idx + i < arr.length - 1) arr[idx + i + 1].focus();
      }
    });
  });

  on('btn-send-reset', 'click', doForgotPassword);
  on('forgot-email', 'keydown', e => { if (e.key === 'Enter') doForgotPassword(); });
  
  on('btn-reset-password', 'click', doResetPassword);
  on('reset-password', 'keydown', e => { if (e.key === 'Enter') doResetPassword(); });

  on('btn-profile', 'click', () => {
    const L = translations[currentLang];
    document.getElementById('profile-name').value = currentUser.name || '';
    document.getElementById('profile-display-name').textContent = currentUser.name || (currentLang === 'ar' ? 'اسم المستخدم' : 'User Name');
    document.getElementById('profile-display-role').textContent = currentUser.is_admin 
      ? L.role_admin 
      : L.role_instructor;
      
    document.getElementById('profile-username').value = currentUser.username || '';
    document.getElementById('profile-email').value = currentUser.email || '';
    document.getElementById('profile-password').value = '';
    
    // Member since
    if (currentUser.created_at) {
      const d = new Date(currentUser.created_at);
      const dateStr = d.toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', { year:'numeric', month:'long', day:'numeric' });
      document.getElementById('profile-member-since').textContent = (currentLang === 'ar' ? 'عضو منذ: ' : 'Member Since: ') + dateStr;
    }
    document.getElementById('profile-user-id').textContent = 'ID: #' + String(currentUser.id).padStart(4, '0');
    
    document.getElementById('profile-confirm').value = '';
    document.getElementById('error-profile-confirm').classList.add('hidden');

    // Reset strength bar
    window.updatePasswordStrengthProfile('');
    
    // Set UI Mode radio
    const uiModeRadio = document.querySelector(`input[name="input-ui-mode"][value="${currentUIMode}"]`);
    if (uiModeRadio) uiModeRadio.checked = true;

    document.getElementById('profile-error').classList.add('hidden');
    openModal('modal-profile');
  });
  
  on('btn-save-profile', 'click', async () => {
    const name = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const password = document.getElementById('profile-password').value;
    const err = document.getElementById('profile-error');
    err.classList.add('hidden');
    
    try {
      const payload = {};
      if (name !== currentUser.name) payload.name = name;
      if (email !== currentUser.email) payload.email = email;
      if (password) {
        const confirm = document.getElementById('profile-confirm').value;
        const errConfirm = document.getElementById('error-profile-confirm');
        if (password !== confirm) {
          errConfirm.textContent = translations[currentLang].passwords_dont_match;
          errConfirm.classList.remove('hidden');
          return;
        } else {
          errConfirm.classList.add('hidden');
        }
        payload.password = password;
      }
      
      // Include ui_mode in the profile payload
      const selectedUIMode = document.querySelector('input[name="input-ui-mode"]:checked')?.value || 'modern';
      payload.ui_mode = selectedUIMode === 'simple' ? 'simple' : 'standard';

      currentUser = await apiFetch('/auth/profile', {
        method: 'PUT', body: JSON.stringify(payload)
      });

      if (selectedUIMode !== currentUIMode) {
        currentUIMode = selectedUIMode;
        localStorage.setItem('ui-mode', currentUIMode);
        // Reload so the backend can serve the correct frontend folder
        toast(translations[currentLang].profile_updated, 'success');
        setTimeout(() => { window.location.reload(); }, 800);
        return;
      }

      toast(translations[currentLang].profile_updated, 'success');
      closeModal('modal-profile');
    } catch(e) {
      err.textContent = e.message;
      err.classList.remove('hidden');
    }
  });

  on('btn-add-user', 'click', () => {
    document.getElementById('new_user-name').value = '';
    document.getElementById('new_user-username').value = '';
    document.getElementById('new_user-password').value = '';
    document.getElementById('new_user-is_admin').checked = false;
    document.getElementById('new_user-confirm').value = '';
    document.getElementById('error-new_user-confirm').classList.add('hidden');
    document.getElementById('add-user-error').classList.add('hidden');
    openModal('modal-add-user');
  });

  on('btn-save-new-user', 'click', async () => {
    const btn = document.getElementById('btn-save-new-user');
    const name = document.getElementById('new_user-name').value.trim();
    const username = document.getElementById('new_user-username').value.trim();
    const password = document.getElementById('new_user-password').value;
    const confirm = document.getElementById('new_user-confirm').value;
    const is_admin = document.getElementById('new_user-is_admin').checked;
    const err = document.getElementById('add-user-error');
    const errConfirm = document.getElementById('error-new_user-confirm');
    
    if (!username || !password) {
      err.textContent = 'Username and Password are required';
      err.classList.remove('hidden');
      return;
    } else {
      err.classList.add('hidden');
    }

    if (password !== confirm) {
      errConfirm.textContent = translations[currentLang].passwords_dont_match;
      errConfirm.classList.remove('hidden');
      return;
    } else {
      errConfirm.classList.add('hidden');
    }
    
    btn.disabled = true;
    try {
      await apiFetch('/auth/register', {
        method: 'POST', body: JSON.stringify({ name, username, password, is_admin })
      });
      toast(translations[currentLang].user_created, 'success');
      closeModal('modal-add-user');
      if (document.getElementById('view-admin').classList.contains('hidden') === false) {
        loadUsers();
      }
    } catch(e) {
      err.textContent = e.message;
      err.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });


  /* ── Quizzes Events ── */
  on('btn-add-quiz', 'click', async () => {
    document.getElementById('input-quiz-id').value = '';
    document.getElementById('input-quiz-name').value = '';
    document.getElementById('input-quiz-max').value = '10';
    document.getElementById('input-quiz-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('input-quiz-notes').value = '';
    
    await populateQuizSessions();
    document.getElementById('input-quiz-as-attendance').checked = false;
    updateQuizAttendanceToggle(); // Ensure it's disabled initially
    updateFileStatus('quiz', null);
    updateFileStatus('answer', null);

    document.getElementById('modal-quiz-title').textContent = 'New Quiz';
    document.getElementById('quiz-modal-error').classList.add('hidden');
    openModal('modal-quiz');
  });

  on('btn-save-quiz', 'click', async () => {
    const btn = document.getElementById('btn-save-quiz');
    const id = document.getElementById('input-quiz-id').value;
    const name = document.getElementById('input-quiz-name').value.trim();
    const max_score = document.getElementById('input-quiz-max').value;
    const quiz_date = document.getElementById('input-quiz-date').value;
    const notes = document.getElementById('input-quiz-notes').value.trim();
    const session_id = document.getElementById('input-quiz-session').value;
    const use_as_attendance = document.getElementById('input-quiz-as-attendance').checked;
    const err = document.getElementById('quiz-modal-error');

    if (!name || !quiz_date) {
      err.textContent = 'Name and Date are required.';
      err.classList.remove('hidden');
      return;
    }
    
    if (use_as_attendance && !session_id) {
      err.textContent = 'Linked Session must be selected if Use Quiz as Attendance is Yes.';
      err.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('max_score', max_score);
      fd.append('quiz_date', quiz_date);
      fd.append('notes', notes);
      fd.append('session_id', session_id);
      fd.append('use_as_attendance', use_as_attendance);
      
      const qFile = document.getElementById('input-quiz-file').files[0];
      if (qFile) fd.append('quiz_file', qFile);
      
      const aFile = document.getElementById('input-model-answer-file').files[0];
      if (aFile) fd.append('model_answer_file', aFile);

      // Handle removals of existing files in EDIT mode
      if (id) {
        if (document.getElementById('quiz-file-status').classList.contains('pending-delete'))
          fd.append('delete_quiz_file', 'true');
        if (document.getElementById('answer-file-status').classList.contains('pending-delete'))
          fd.append('delete_model_answer_file', 'true');
      }

      const method = id ? 'PUT' : 'POST';
      const path = id ? `/quizzes/${id}` : `/courses/${currentCourseId}/quizzes`;
      
      const res = await fetch(`${API}${path}`, {
        method,
        body: fd
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save quiz.');

      toast(id ? translations[currentLang].quiz_updated : translations[currentLang].quiz_created, 'success');
      closeModal('modal-quiz');
      loadQuizzes(currentCourseId);
      loadQuizSummary(currentCourseId);
    } catch (e) {
      err.textContent = e.message;
      err.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Quiz';
    }
  });

  on('input-quiz-session', 'change', updateQuizAttendanceToggle);

  // Quiz File Browsing
  on('btn-browse-quiz-file', 'click', () => document.getElementById('input-quiz-file').click());
  on('input-quiz-file', 'change', e => {
    if (e.target.files[0]) {
      const statusEl = document.getElementById('quiz-file-status');
      statusEl.querySelector('.file-name').textContent = e.target.files[0].name;
      statusEl.classList.remove('hidden', 'pending-delete');
      document.getElementById('btn-browse-quiz-file').classList.add('hidden');
    }
  });
  on('btn-remove-quiz-file', 'click', () => {
    document.getElementById('input-quiz-file').value = '';
    const statusEl = document.getElementById('quiz-file-status');
    statusEl.classList.add('hidden', 'pending-delete');
    document.getElementById('btn-browse-quiz-file').classList.remove('hidden');
  });

  // Answer File Browsing
  on('btn-browse-answer-file', 'click', () => document.getElementById('input-model-answer-file').click());
  on('input-model-answer-file', 'change', e => {
    if (e.target.files[0]) {
      const statusEl = document.getElementById('answer-file-status');
      statusEl.querySelector('.file-name').textContent = e.target.files[0].name;
      statusEl.classList.remove('hidden', 'pending-delete');
      document.getElementById('btn-browse-answer-file').classList.add('hidden');
    }
  });
  on('btn-remove-answer-file', 'click', () => {
    document.getElementById('input-model-answer-file').value = '';
    const statusEl = document.getElementById('answer-file-status');
    statusEl.classList.add('hidden', 'pending-delete');
    document.getElementById('btn-browse-answer-file').classList.remove('hidden');
  });

  on('btn-quiz-back', 'click', () => {
    document.getElementById('panel-quiz-detail').classList.add('hidden');
    document.querySelector('.detail-tabs').classList.remove('hidden');
    if (quizBackSource === 'sessions') {
      switchDetailTab('dtab-sessions');
    } else {
      switchDetailTab('dtab-quizzes');
    }
  });

  on('quick-quiz-id-input', 'keydown', e => {
     if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('quick-quiz-grade-input').focus();
     }
  });
  on('quick-quiz-grade-input', 'keydown', e => {
     if (e.key === 'Enter') {
       e.preventDefault();
       doQuickGrade();
     }
  });
  on('btn-quick-grade-submit', 'click', e => {
     e.preventDefault();
     doQuickGrade();
  });

  on('btn-export-all-quizzes-excel', 'click', () => {
    if (!currentCourseId) return;
    const url = `${API}/courses/${currentCourseId}/export-quizzes/excel`;
    window.location.href = url;
    toast(translations[currentLang].downloading || 'Downloading...', 'info');
  });

  /* ── Export Choice ── */
  const startExportWithChoice = (format) => {
    document.getElementById('export-format-hidden').value = format;
    openModal('modal-export-options');
  };

  on('export-quiz-excel', 'click', e => { e.preventDefault(); startExportWithChoice('excel'); });
  on('export-quiz-word', 'click', e => { e.preventDefault(); startExportWithChoice('word'); });
  on('export-quiz-pdf', 'click', e => { e.preventDefault(); startExportWithChoice('pdf'); });

  on('btn-confirm-export', 'click', () => {
    const format = document.getElementById('export-format-hidden').value;
    const includeNames = document.querySelector('input[name="export-names"]:checked').value;
    const url = `${API}/quizzes/${currentQuizId}/export/${format}?include_names=${includeNames}`;
    window.open(url, '_blank');
    closeModal('modal-export-options');
  });

  /* ── Quick Add Student ── */
  document.querySelectorAll('.btn-open-add-student').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('input-add-student-id').value = '';
      document.getElementById('input-add-student-name').value = '';
      document.getElementById('add-student-modal-error').classList.add('hidden');
      openModal('modal-add-student');
      setTimeout(() => document.getElementById('input-add-student-id').focus(), 100);
    };
  });

  ['input-add-student-id', 'input-add-student-name'].forEach(id => {
    on(id, 'keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-save-new-student').click();
    });
  });

  on('btn-save-new-student', 'click', async () => {
    const sid = document.getElementById('input-add-student-id').value.trim();
    const name = document.getElementById('input-add-student-name').value.trim();
    const err = document.getElementById('add-student-modal-error');
    if (!sid || !name) {
      err.textContent = 'Both fields are required.';
      err.classList.remove('hidden');
      return;
    }
    try {
      const res = await apiFetch(`/courses/${currentCourseId}/students/quick-add`, {
        method: 'POST', body: JSON.stringify({ student_id: sid, name })
      });
      toast(res.message, 'success');
      closeModal('modal-add-student');
      
      // Refresh current context
      if (currentSessionId) await loadRoster(currentSessionId);
      if (currentQuizId) await loadQuizRoster(currentQuizId);
      await loadEnrolledStudents(currentCourseId);
      await loadEnrollableStudents(currentCourseId); // Refresh the enroll tab too
      loadDashboard();
    } catch(e) {
      err.textContent = e.message;
      err.classList.remove('hidden');
    }
  });

  /* ─── Group Division ─── */
  const btnDivide = document.getElementById('btn-divide-groups');
  if (btnDivide) {
    btnDivide.addEventListener('click', async () => {
      const count = parseInt(document.getElementById('input-group-count').value);
      if (!count || count < 1) return toast('Invalid group count', 'error');
      
      const btn = document.getElementById('btn-divide-groups');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = translations[currentLang].loading;

      try {
        const res = await apiFetch(`/courses/${currentCourseId}/groups/divide?num_groups=${count}`);
        renderGroups(res.groups);
        
        // Save to localStorage persistence
        localStorage.setItem(`groups_${currentCourseId}`, JSON.stringify({
          groups: res.groups,
          count: count,
          timestamp: new Date().getTime()
        }));
        
        document.getElementById('groups-export-actions').classList.remove('hidden');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }

  // renderGroups moved to global scope

  document.getElementById('btn-groups-export-excel')?.addEventListener('click', () => {
    const count = document.getElementById('input-group-count').value;
    window.location.href = `${API}/courses/${currentCourseId}/groups/export/excel?num_groups=${count}`;
  });
  document.getElementById('btn-groups-export-word')?.addEventListener('click', () => {
    const count = document.getElementById('input-group-count').value;
    window.location.href = `${API}/courses/${currentCourseId}/groups/export/word?num_groups=${count}`;
  });
  document.getElementById('btn-groups-export-pdf')?.addEventListener('click', () => {
    const count = document.getElementById('input-group-count').value;
    window.location.href = `${API}/courses/${currentCourseId}/groups/export/pdf?num_groups=${count}`;
  });

  on('btn-save-smtp', 'click', saveEmailSettings);

  on('btn-theme-toggle', 'click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', currentTheme);
    applyTheme();
  });

  /* ─── Chatbot ─── */
  function initChatbot() {
    const trigger = document.getElementById('btn-chatbot-trigger');
    const container = document.getElementById('chatbot-container');
    const inputField = document.getElementById('chatbot-input-field');
    const msgsContainer = document.getElementById('chatbot-messages');

    if (!trigger) return;

    on('btn-chatbot-trigger', 'click', () => {
      container.classList.toggle('hidden');
      if (!container.classList.contains('hidden')) {
        inputField.focus();
      }
    });

    on('btn-close-chatbot', 'click', () => {
      container.classList.add('hidden');
    });

    const appendMsg = (text, side) => {
      const msg = document.createElement('div');
      msg.className = `chat-msg ${side}`;
      // Simple markdown-ish support for **bold**
      const formatted = esc(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      msg.innerHTML = `<div class="msg-bubble">${formatted}</div>`;
      msgsContainer.appendChild(msg);
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
    };

    const handleSend = async () => {
      const val = inputField.value.trim();
      if (!val) return;

      appendMsg(val, 'user');
      inputField.value = '';

      // Thinking indicator
      const thinking = document.createElement('div');
      thinking.className = 'chat-msg bot';
      thinking.innerHTML = `<div class="msg-bubble"><em>${translations[currentLang].chatbot_thinking}</em></div>`;
      msgsContainer.appendChild(thinking);
      msgsContainer.scrollTop = msgsContainer.scrollHeight;

      try {
        const res = await apiFetch('/chatbot', {
          method: 'POST',
          body: JSON.stringify({ message: val })
        });
        thinking.remove();
        appendMsg(res.reply, 'bot');
      } catch (e) {
        thinking.remove();
        appendMsg(e.message, 'bot');
      }
    };

    on('btn-send-chat', 'click', handleSend);
    inputField.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSend();
    });
  }

  /* ── INIT ── */
  updateUI();   // Apply saved language after DOM is ready
  updateClock();
  checkAuth();
  initChatbot();
});
