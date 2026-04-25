import json
from datetime import date

from academic_logic import ensure_default_curricula, ensure_default_sections, ensure_schedule_offerings
from models import (
    Announcement,
    Curriculum,
    Faculty,
    Lesson,
    Organization,
    Report,
    Research,
    Schedule,
    Section,
    Student,
    StudentAcademicHistory,
    StudentAffiliation,
    StudentNonAcademicActivity,
    StudentSkill,
    StudentViolation,
    Syllabus,
    User,
    db,
)


def get_or_create(model, filters, defaults=None):
    instance = model.query.filter_by(**filters).first()
    created = instance is None

    if created:
        instance = model(**filters, **(defaults or {}))
        db.session.add(instance)
    elif defaults:
        for key, value in defaults.items():
            setattr(instance, key, value)

    return instance, created


def seed_users() -> None:
    """Seed demo accounts for each supported role."""
    demo_accounts = [
        {'email': 'admin@example.com', 'username': 'admin', 'role': 'DEAN'},
        {'email': 'chair@example.com', 'username': 'chair', 'role': 'CHAIR'},
        {'email': 'faculty@example.com', 'username': 'faculty', 'role': 'FACULTY'},
        {'email': 'secretary@example.com', 'username': 'secretary', 'role': 'SECRETARY'},
        {'email': 'ana.reyes@student.ccs.local', 'username': 'student_ana', 'role': 'STUDENT'},
    ]

    for account in demo_accounts:
        user, created = get_or_create(
            User,
            {'email': account['email']},
            {
                'username': account['username'],
                'role': account['role'],
                'tenant_id': None,
                'is_active': True,
            },
        )
        # Keep a predictable demo password for all seeded accounts.
        if created or not user.check_password('admin123'):
            user.set_password('admin123')


def seed_faculty() -> list[Faculty]:
    faculty_records = [
        {
            'employee_number': 'FAC-1001',
            'first_name': 'Elena',
            'last_name': 'Ramos',
            'middle_name': 'S.',
            'birthday': '1988-04-23',
            'email': 'chair@example.com',
            'contact_number': '09171234567',
            'department': 'BSIT',
            'position': 'Department Chair',
            'employment_status': 'Full-time',
        },
        {
            'employee_number': 'FAC-1002',
            'first_name': 'Marco',
            'last_name': 'Villanueva',
            'middle_name': 'D.',
            'birthday': '1990-11-09',
            'email': 'faculty@example.com',
            'contact_number': '09179876543',
            'department': 'BSIT',
            'position': 'Professor',
            'employment_status': 'Full-time',
        },
        {
            'employee_number': 'FAC-1003',
            'first_name': 'Sofia',
            'last_name': 'Mendoza',
            'middle_name': 'R.',
            'birthday': '1991-07-21',
            'email': 'sofia.mendoza@ccs.local',
            'contact_number': '09172224444',
            'department': 'BSCS',
            'position': 'Professor',
            'employment_status': 'Full-time',
        },
        {
            'employee_number': 'FAC-1004',
            'first_name': 'Daniel',
            'last_name': 'Cruz',
            'middle_name': 'P.',
            'birthday': '1989-02-18',
            'email': 'daniel.cruz@ccs.local',
            'contact_number': '09173335555',
            'department': 'BSCS',
            'position': 'Associate Professor',
            'employment_status': 'Full-time',
        },
    ]

    faculty_members: list[Faculty] = []
    for record in faculty_records:
        member, _ = get_or_create(
            Faculty,
            {'employee_number': record['employee_number']},
            {key: value for key, value in record.items() if key != 'employee_number'},
        )
        faculty_members.append(member)

    return faculty_members


def seed_students() -> list[Student]:
    student_records = [
        {
            'student_id': '2024-0001',
            'first_name': 'Ana',
            'last_name': 'Reyes',
            'middle_name': 'M.',
            'birthday': '2005-02-15',
            'email': 'ana.reyes@student.ccs.local',
            'contact_number': '09170000001',
            'course': 'BSIT',
            'year_level': '2nd Year',
            'section': 'A',
            'enrollment_status': 'Enrolled',
        },
        {
            'student_id': '2024-0002',
            'first_name': 'Miguel',
            'last_name': 'Santos',
            'middle_name': 'P.',
            'birthday': '2004-07-28',
            'email': 'miguel.santos@student.ccs.local',
            'contact_number': '09170000002',
            'course': 'BSCS',
            'year_level': '3rd Year',
            'section': 'B',
            'enrollment_status': 'Enrolled',
        },
        {
            'student_id': '2024-0003',
            'first_name': 'Bianca',
            'last_name': 'Cruz',
            'middle_name': 'L.',
            'birthday': '2006-01-05',
            'email': 'bianca.cruz@student.ccs.local',
            'contact_number': '09170000003',
            'course': 'BSIT',
            'year_level': '1st Year',
            'section': 'C',
            'enrollment_status': 'Enrolled',
        },
    ]

    students: list[Student] = []
    for record in student_records:
        student, _ = get_or_create(
            Student,
            {'student_id': record['student_id']},
            {key: value for key, value in record.items() if key != 'student_id'},
        )
        students.append(student)

    return students


def seed_student_details(students: list[Student]) -> None:
    details_by_student = {
        '2024-0001': {
            'skills': [('Programming', 'Advanced'), ('Basketball', 'Intermediate')],
            'academic_history': [('2023-2024', 'BSIT', 'Dean\'s Lister')],
            'activities': [('Academic', 'Hackathon 2025', 'Joined the college hackathon finals')],
            'violations': [('Late Submission', 'Low', None, 'Warning issued during first semester')],
            'affiliations': [('SITES', 'Org', 'Member'), ('CCS Basketball Team', 'Sports', 'Player')],
        },
        '2024-0002': {
            'skills': [('Programming', 'Advanced'), ('Data Analysis', 'Intermediate')],
            'academic_history': [('2022-2023', 'BSCS', 'Completed core algorithm subjects')],
            'activities': [('Volunteer', 'Peer Tutoring', 'Assists first-year students weekly')],
            'violations': [],
            'affiliations': [('Google Developer Student Clubs', 'Org', 'Officer')],
        },
        '2024-0003': {
            'skills': [('Basketball', 'Beginner'), ('Documentation', 'Intermediate')],
            'academic_history': [('2024-2025', 'BSIT', 'Freshman student record')],
            'activities': [('Sports', 'Intramurals Basketball', 'Participated in college intramurals')],
            'violations': [('Uniform Violation', 'Low', None, 'Resolved with guidance office')],
            'affiliations': [('CCS Student Council', 'Org', 'Volunteer')],
        },
    }

    for student in students:
        detail = details_by_student.get(student.student_id, {})

        for skill_name, level in detail.get('skills', []):
            get_or_create(
                StudentSkill,
                {'student_id': student.id, 'skill_name': skill_name},
                {'level': level},
            )

        for academic_year, course, details in detail.get('academic_history', []):
            get_or_create(
                StudentAcademicHistory,
                {
                    'student_id': student.id,
                    'academic_year': academic_year,
                    'course': course,
                },
                {'details': details},
            )

        for activity_type, activity_name, activity_details in detail.get('activities', []):
            get_or_create(
                StudentNonAcademicActivity,
                {
                    'student_id': student.id,
                    'activity_name': activity_name,
                },
                {'activity_type': activity_type, 'details': activity_details},
            )

        for violation_name, severity, date_value, violation_details in detail.get('violations', []):
            get_or_create(
                StudentViolation,
                {
                    'student_id': student.id,
                    'violation_name': violation_name,
                },
                {
                    'severity': severity,
                    'date': date_value,
                    'details': violation_details,
                },
            )

        for name, category, role in detail.get('affiliations', []):
            get_or_create(
                StudentAffiliation,
                {'student_id': student.id, 'name': name},
                {'category': category, 'role': role},
            )


def seed_organizations() -> list[Organization]:
    organization_records = [
        {
            'name': 'SITES',
            'full_name': 'Society of Information Technology Enthusiasts and Students',
            'members': 120,
            'events_count': 4,
            'status': 'Active',
            'color': 'bg-blue-500',
            'description': 'Student organization for BSIT learners.',
        },
        {
            'name': 'GDSC',
            'full_name': 'Google Developer Student Clubs',
            'members': 85,
            'events_count': 3,
            'status': 'Active',
            'color': 'bg-green-500',
            'description': 'Community for workshops, projects, and tech talks.',
        },
    ]

    organizations: list[Organization] = []
    for record in organization_records:
        org, _ = get_or_create(
            Organization,
            {'name': record['name'], 'tenant_id': None},
            {key: value for key, value in record.items() if key != 'name'},
        )
        organizations.append(org)

    return organizations


def seed_schedules(faculty_members: list[Faculty]) -> None:
    ensure_default_sections()
    ensure_default_curricula()
    ensure_schedule_offerings()
    db.session.flush()

    faculty_lookup = {member.employee_number: member for member in faculty_members}
    default_assignments = [
        ('BSIT', '1st Year', 'A', '1st Semester', 'CCS101', 'FAC-1001'),
        ('BSIT', '1st Year', 'A', '1st Semester', 'CCS102', 'FAC-1002'),
        ('BSIT', '2nd Year', 'A', '2nd Semester', 'ITEW2', 'FAC-1002'),
        ('BSCS', '3rd Year', 'B', '1st Semester', 'CSC301', 'FAC-1003'),
        ('BSCS', '4th Year', 'A', '1st Semester', 'CSC401', 'FAC-1004'),
    ]

    for course, year_level, section, semester, subject_code, faculty_key in default_assignments:
        faculty_member = faculty_lookup.get(faculty_key)
        if not faculty_member:
            continue

        schedule = Schedule.query.filter_by(
            course=course,
            year_level=year_level,
            section=section,
            semester=semester,
            subject_code=subject_code,
        ).first()
        if not schedule:
            continue

        schedule.faculty_id = faculty_member.id
        schedule.instructor = ' '.join(
            part for part in [faculty_member.first_name, faculty_member.middle_name, faculty_member.last_name] if part
        ).strip()


def seed_announcements() -> None:
    announcement_records = [
        {
            'course': 'BSIT',
            'year_level': '1st Year',
            'section': 'A',
            'semester': '1st Semester',
            'subject_code': 'CCS101',
            'title': 'Bring your lab notebook',
            'content': 'Please bring a notebook and your updated student ID for our introduction to lab safety.',
        },
        {
            'course': 'BSIT',
            'year_level': '2nd Year',
            'section': 'A',
            'semester': '2nd Semester',
            'subject_code': 'ITEW2',
            'title': 'Client-side scripting project groups',
            'content': 'Project groups will be finalized this week. Review DOM manipulation before the next meeting.',
        },
        {
            'course': 'BSCS',
            'year_level': '3rd Year',
            'section': 'B',
            'semester': '1st Semester',
            'subject_code': 'CSC301',
            'title': 'Algorithm design consultation',
            'content': 'Consultation slots are open on Friday afternoon for your divide-and-conquer analysis exercise.',
        },
    ]

    for record in announcement_records:
        schedule = Schedule.query.filter_by(
            course=record['course'],
            year_level=record['year_level'],
            section=record['section'],
            semester=record['semester'],
            subject_code=record['subject_code'],
        ).first()
        if not schedule:
            continue

        get_or_create(
            Announcement,
            {
                'schedule_id': schedule.id,
                'title': record['title'],
            },
            {
                'faculty_id': schedule.faculty_id,
                'faculty_name': schedule.instructor,
                'course': schedule.course,
                'year_level': schedule.year_level,
                'section': schedule.section,
                'semester': schedule.semester,
                'subject_code': schedule.subject_code,
                'subject': schedule.subject,
                'content': record['content'],
                'tenant_id': schedule.tenant_id,
            },
        )


def seed_events() -> None:
    report_records = [
        {
            'title': 'CCS General Assembly',
            'report_type': 'event',
            'description': 'Semester opening assembly for all CCS students.',
            'organization': 'SITES',
            'date': date.fromisoformat('2026-04-10'),
            'time': '09:00',
            'venue': 'Main Auditorium',
            'status': 'Upcoming',
            'participants': 250,
            'registered': 180,
            'category': 'Academic',
        },
        {
            'title': 'Hackathon Kickoff',
            'report_type': 'event',
            'description': 'Launch event for the annual CCS hackathon.',
            'organization': 'GDSC',
            'date': date.fromisoformat('2026-04-18'),
            'time': '13:00',
            'venue': 'Innovation Hub',
            'status': 'Registration Open',
            'participants': 120,
            'registered': 74,
            'category': 'Technology',
        },
    ]

    for record in report_records:
        get_or_create(
            Report,
            {'title': record['title']},
            {key: value for key, value in record.items() if key != 'title'},
        )


def seed_research() -> None:
    research_records = [
        {
            'title': 'Student Skill Profiling for Personalized Advising',
            'description': 'A study on matching student strengths to college support programs.',
            'authors': json.dumps(['Elena Ramos', 'Marco Villanueva']),
            'category': 'Data Science',
            'status': 'Published',
            'keywords': json.dumps(['Profiling', 'Education', 'Analytics']),
            'citations': 12,
            'views': 180,
            'downloads': 65,
            'journal': 'CCS Research Journal',
            'doi': '10.1000/ccs.001',
            'year': '2025',
        },
        {
            'title': 'Improving Scheduling Accuracy in Small Academic Units',
            'description': 'Research on simple validation workflows for faculty and room scheduling.',
            'authors': json.dumps(['Marco Villanueva']),
            'category': 'Software Engineering',
            'status': 'Under Review',
            'keywords': json.dumps(['Scheduling', 'Validation', 'Workflow']),
            'citations': 4,
            'views': 95,
            'downloads': 21,
            'journal': 'Campus Systems Review',
            'doi': '10.1000/ccs.002',
            'year': '2026',
        },
    ]

    for record in research_records:
        get_or_create(
            Research,
            {'title': record['title']},
            {key: value for key, value in record.items() if key != 'title'},
        )


def seed_instructions() -> None:
    syllabus, _ = get_or_create(
        Syllabus,
        {'code': 'ITEW2', 'academic_year': '2025-2026'},
        {
            'course': 'BSIT',
            'subject': 'Client Side Scripting',
            'instructor': 'Marco Villanueva',
            'semester': '2nd Semester',
            'units': 3,
            'hours': 3,
            'description': 'Core client-side scripting course for second-year BSIT students.',
            'objectives': json.dumps(
                [
                    'Build interactive client-side web interfaces.',
                    'Apply DOM manipulation and event handling.',
                    'Integrate form validation and browser storage patterns.',
                ]
            ),
            'topics': json.dumps(
                [
                    {'week': 1, 'topic': 'JavaScript Fundamentals', 'hours': 3},
                    {'week': 2, 'topic': 'DOM Manipulation and Events', 'hours': 3},
                ]
            ),
            'requirements': json.dumps(
                [
                    {'type': 'Projects', 'weight': 40},
                    {'type': 'Exams', 'weight': 35},
                    {'type': 'Quizzes', 'weight': 25},
                ]
            ),
            'status': 'Active',
        },
    )
    db.session.flush()

    lesson_records = [
        {
            'syllabus_id': syllabus.id,
            'title': 'JavaScript syntax and browser execution',
            'week': 1,
            'duration': '3 hours',
            'type': 'Lecture',
            'materials': json.dumps(
                [
                    {'name': 'Slides - JavaScript Basics', 'type': 'PDF', 'size': '1.2 MB'},
                    {'name': 'Browser Console Exercises', 'type': 'ZIP', 'size': '2.1 MB'},
                ]
            ),
            'activities': json.dumps(
                [
                    {'name': 'Syntax Drill Set', 'dueDate': '2026-04-03', 'status': 'Pending'},
                ]
            ),
            'objectives': json.dumps(
                [
                    'Explain the JavaScript execution flow inside the browser.',
                    'Write simple expressions, conditions, and loops.',
                ]
            ),
            'status': 'Published',
        },
        {
            'syllabus_id': syllabus.id,
            'title': 'DOM manipulation and event handling',
            'week': 2,
            'duration': '3 hours',
            'type': 'Laboratory',
            'materials': json.dumps(
                [
                    {'name': 'DOM API Checklist', 'type': 'DOCX', 'size': '420 KB'},
                ]
            ),
            'activities': json.dumps(
                [
                    {'name': 'Interactive Form Exercise', 'dueDate': '2026-04-10', 'status': 'Pending'},
                ]
            ),
            'objectives': json.dumps(
                [
                    'Manipulate document nodes using JavaScript.',
                    'Handle form and button events safely.',
                ]
            ),
            'status': 'Published',
        },
    ]

    for record in lesson_records:
        get_or_create(
            Lesson,
            {
                'syllabus_id': record['syllabus_id'],
                'title': record['title'],
                'week': record['week'],
            },
            {key: value for key, value in record.items() if key not in {'syllabus_id', 'title', 'week'}},
        )


def seed_demo_data() -> None:
    seed_users()
    faculty_members = seed_faculty()
    students = seed_students()
    db.session.flush()
    seed_student_details(students)
    seed_organizations()
    seed_schedules(faculty_members)
    seed_events()
    seed_research()
    seed_instructions()
    seed_announcements()
