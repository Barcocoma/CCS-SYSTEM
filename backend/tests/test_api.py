import os
import sys
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ['MONGO_MOCK'] = 'true'
os.environ['MONGO_DB_NAME'] = 'ccs_system_test'

from app import create_app  # noqa: E402
from models import db  # noqa: E402
from seeds import seed_demo_data  # noqa: E402


class CCSApiSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app(
            {
                'TESTING': True,
                'MONGO_MOCK': True,
                'MONGO_DB_NAME': 'ccs_system_test',
            }
        )

        with cls.app.app_context():
            db.drop_all()
            db.create_all()
            seed_demo_data()
            db.session.commit()

    @classmethod
    def tearDownClass(cls):
        with cls.app.app_context():
            db.session.remove()
            db.drop_all()
            db.engine.dispose()

    def setUp(self):
        self.client = self.app.test_client()

    def test_auth_register_login_and_logout(self):
        register_response = self.client.post(
            '/api/auth/register',
            json={
                'username': 'tester',
                'email': 'tester@example.com',
                'password': 'secret123',
                'role': 'FACULTY',
            },
        )
        self.assertEqual(register_response.status_code, 201)
        self.assertTrue(register_response.get_json()['success'])

        login_response = self.client.post(
            '/api/auth/login',
            json={'email': 'admin@example.com', 'password': 'admin123'},
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(login_response.get_json()['success'])

        logout_response = self.client.post(
            '/api/auth/logout',
            json={'username': 'admin', 'email': 'admin@example.com'},
        )
        self.assertEqual(logout_response.status_code, 200)
        self.assertTrue(logout_response.get_json()['success'])

        account_response = self.client.put(
            '/api/auth/account/1',
            json={
                'username': 'admin',
                'email': 'admin.updated@example.com',
                'password': 'admin123',
            },
        )
        self.assertEqual(account_response.status_code, 200)
        self.assertEqual(account_response.get_json()['data']['email'], 'admin.updated@example.com')

    def test_student_crud_and_query_filters(self):
        create_response = self.client.post(
            '/api/students',
            json={
                'student_id': '2026-0999',
                'first_name': 'Jamie',
                'last_name': 'Torres',
                'middle_name': 'A.',
                'email': 'jamie.torres@example.com',
                'contact_number': '09171112222',
                'course': 'BSIT',
                'year_level': '4th Year',
                'enrollment_status': 'Enrolled',
            },
        )
        self.assertEqual(create_response.status_code, 201)
        student = create_response.get_json()['data']
        student_id = student['id']

        skill_response = self.client.post(
            f'/api/students/{student_id}/skills',
            json={'skill_name': 'Programming', 'level': 'Advanced'},
        )
        self.assertEqual(skill_response.status_code, 201)

        activity_response = self.client.post(
            f'/api/students/{student_id}/activities',
            json={'activity_name': 'Hackathon 2026', 'activity_type': 'Academic'},
        )
        self.assertEqual(activity_response.status_code, 201)

        affiliation_response = self.client.post(
            f'/api/students/{student_id}/affiliations',
            json={'name': 'CCS Esports Club', 'category': 'Org', 'role': 'Member'},
        )
        self.assertEqual(affiliation_response.status_code, 201)
        affiliation_id = affiliation_response.get_json()['data']

        skill_id = skill_response.get_json()['data']
        skill_update = self.client.put(
            f'/api/students/{student_id}/skills/{skill_id}',
            json={'skill_name': 'Programming', 'level': 'Intermediate'},
        )
        self.assertEqual(skill_update.status_code, 200)

        activity_id = activity_response.get_json()['data']
        activity_update = self.client.put(
            f'/api/students/{student_id}/activities/{activity_id}',
            json={'activity_name': 'Hackathon 2026', 'activity_type': 'Competition'},
        )
        self.assertEqual(activity_update.status_code, 200)

        affiliation_update = self.client.put(
            f'/api/students/{student_id}/affiliations/{affiliation_id}',
            json={'name': 'CCS Esports Club', 'category': 'Organization', 'role': 'Officer'},
        )
        self.assertEqual(affiliation_update.status_code, 200)

        detail_response = self.client.get(f'/api/students/{student_id}')
        self.assertEqual(detail_response.status_code, 200)
        detail_data = detail_response.get_json()['data']
        self.assertEqual(detail_data['student_id'], '2026-0999')
        self.assertEqual(len(detail_data['skills']), 1)

        programming_query = self.client.get('/api/students?skill=Programming')
        programming_students = programming_query.get_json()['data']
        self.assertTrue(any(student['student_id'] == '2026-0999' for student in programming_students))

        activity_query = self.client.get('/api/students?activity=Hackathon 2026')
        self.assertTrue(any(student['student_id'] == '2026-0999' for student in activity_query.get_json()['data']))

        affiliation_query = self.client.get('/api/students?affiliation=CCS Esports Club')
        self.assertTrue(any(student['student_id'] == '2026-0999' for student in affiliation_query.get_json()['data']))

        update_response = self.client.put(
            f'/api/students/{student_id}',
            json={
                'student_id': '2026-0999',
                'first_name': 'Jamie',
                'last_name': 'Torres',
                'middle_name': 'A.',
                'email': 'jamie.updated@example.com',
                'contact_number': '09171112222',
                'course': 'BSIT',
                'year_level': '4th Year',
                'enrollment_status': 'Graduated',
            },
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()['data']['enrollment_status'], 'Graduated')

        delete_response = self.client.delete(f'/api/students/{student_id}')
        self.assertEqual(delete_response.status_code, 200)
        self.assertTrue(delete_response.get_json()['success'])

    def test_faculty_crud(self):
        create_response = self.client.post(
            '/api/faculty',
            json={
                'employee_number': 'FAC-9090',
                'first_name': 'Lea',
                'last_name': 'Mendoza',
                'middle_name': 'R.',
                'email': 'lea.mendoza@example.com',
                'contact_number': '09179998888',
                'department': 'BSIT',
                'position': 'Instructor',
                'employment_start_date': '2024-06-01',
                'employment_status': 'Full-time',
            },
        )
        self.assertEqual(create_response.status_code, 201)
        faculty_id = create_response.get_json()['data']['id']

        update_response = self.client.put(
            f'/api/faculty/{faculty_id}',
            json={
                'employee_number': 'FAC-9090',
                'first_name': 'Lea',
                'last_name': 'Mendoza',
                'middle_name': 'R.',
                'email': 'lea.updated@example.com',
                'contact_number': '09179998888',
                'department': 'BSIT',
                'position': 'Assistant Professor',
                'employment_start_date': '2024-06-01',
                'employment_status': 'Full-time',
            },
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()['data']['position'], 'Assistant Professor')

        delete_response = self.client.delete(f'/api/faculty/{faculty_id}')
        self.assertEqual(delete_response.status_code, 200)
        self.assertTrue(delete_response.get_json()['success'])

    def test_schedule_crud_filter_and_validation(self):
        invalid_response = self.client.post(
            '/api/schedules',
            json={
                'course': 'BSIT',
                'subject': 'Systems Analysis',
                'instructor': 'Lea Mendoza',
                'room': 'Lab 404',
                'day': 'Thursday',
                'start_time': '2:00 PM',
                'end_time': '1:00 PM',
            },
        )
        self.assertEqual(invalid_response.status_code, 400)

        create_response = self.client.post(
            '/api/schedules',
            json={
                'course': 'BSIT',
                'subject': 'Systems Analysis',
                'instructor': 'Lea Mendoza',
                'room': 'Lab 404',
                'day': 'Thursday',
                'start_time': '1:00 PM',
                'end_time': '3:00 PM',
                'students': 30,
                'year_level': '3rd Year',
                'section': 'C',
            },
        )
        self.assertEqual(create_response.status_code, 201)
        schedule_id = create_response.get_json()['data']['id']

        filter_response = self.client.get('/api/schedules?course=BSIT&day=Thursday')
        self.assertTrue(any(item['id'] == schedule_id for item in filter_response.get_json()['data']))

        update_response = self.client.put(
            f'/api/schedules/{schedule_id}',
            json={
                'course': 'BSIT',
                'subject': 'Systems Analysis and Design',
                'instructor': 'Lea Mendoza',
                'room': 'Lab 404',
                'day': 'Thursday',
                'start_time': '1:00 PM',
                'end_time': '3:00 PM',
            },
        )
        self.assertEqual(update_response.status_code, 200)

        delete_response = self.client.delete(f'/api/schedules/{schedule_id}')
        self.assertEqual(delete_response.status_code, 200)

    def test_events_crud_and_filtering(self):
        create_response = self.client.post(
            '/api/reports',
            json={
                'title': 'Capstone Exhibit',
                'report_type': 'event',
                'description': 'Final year project exhibit.',
                'organization': 'SITES',
                'date': '2026-05-20',
                'time': '14:00',
                'venue': 'CCS Hall',
                'status': 'Upcoming',
                'participants': 150,
                'registered': 80,
                'category': 'Academic',
            },
        )
        self.assertEqual(create_response.status_code, 201)
        event_id = create_response.get_json()['data']['id']

        filter_response = self.client.get('/api/reports?report_type=event&organization=SITES')
        self.assertTrue(any(item['id'] == event_id for item in filter_response.get_json()['data']))

        update_response = self.client.put(
            f'/api/reports/{event_id}',
            json={'status': 'Completed', 'title': 'Capstone Exhibit'},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()['data']['status'], 'Completed')

        delete_response = self.client.delete(f'/api/reports/{event_id}')
        self.assertEqual(delete_response.status_code, 200)

    def test_research_crud(self):
        create_response = self.client.post(
            '/api/research',
            json={
                'title': 'Adaptive Student Advising',
                'description': 'Research entry for testing.',
                'authors': ['Elena Ramos'],
                'category': 'Data Science',
                'status': 'Ongoing',
                'keywords': ['Advising', 'Students'],
                'journal': 'Testing Journal',
                'doi': '10.1000/test.001',
                'date': '2026-03-15',
                'year': '2026',
            },
        )
        self.assertEqual(create_response.status_code, 201)
        research_id = create_response.get_json()['data']['id']

        filter_response = self.client.get('/api/research?category=Data Science')
        self.assertTrue(any(item['id'] == research_id for item in filter_response.get_json()['data']))

        update_response = self.client.put(
            f'/api/research/{research_id}',
            json={'status': 'Published', 'title': 'Adaptive Student Advising'},
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.get_json()['data']['status'], 'Published')

        delete_response = self.client.delete(f'/api/research/{research_id}')
        self.assertEqual(delete_response.status_code, 200)

    def test_instructions_crud(self):
        syllabus_response = self.client.post(
            '/api/syllabus',
            json={
                'course': 'BSIT',
                'subject': 'Human Computer Interaction',
                'code': 'IT 410',
                'instructor': 'Elena Ramos',
                'semester': '1st Semester',
                'academic_year': '2026-2027',
                'units': 3,
                'hours': 3,
                'description': 'Syllabus smoke test',
                'objectives': ['Understand UX basics'],
                'topics': [{'week': 1, 'topic': 'Design principles', 'hours': 3}],
                'requirements': [{'type': 'Project', 'weight': 40}],
            },
        )
        self.assertEqual(syllabus_response.status_code, 201)
        syllabus_id = syllabus_response.get_json()['data']['id']

        curriculum_response = self.client.post(
            '/api/curriculum',
            json={
                'course': 'BSIT',
                'program': 'BSIT 2026 Curriculum',
                'year': '2026',
                'total_units': 160,
                'semesters': [
                    {
                        'semester': '1st Year - 1st Semester',
                        'subjects': [{'code': 'IT 101', 'name': 'Intro to Computing', 'units': 3}],
                    }
                ],
            },
        )
        self.assertEqual(curriculum_response.status_code, 201)
        curriculum_id = curriculum_response.get_json()['data']['id']

        lesson_response = self.client.post(
            '/api/lessons',
            json={
                'syllabus_id': syllabus_id,
                'title': 'Introduction to UX',
                'week': 1,
                'duration': '3 hours',
                'type': 'Lecture',
                'materials': [{'name': 'Slides', 'type': 'PDF', 'size': '2 MB'}],
                'activities': [{'name': 'Wireframe Exercise', 'dueDate': '2026-04-01', 'status': 'Pending'}],
                'objectives': ['Explain core UX principles'],
            },
        )
        self.assertEqual(lesson_response.status_code, 201)
        lesson_id = lesson_response.get_json()['data']['id']

        syllabus_update = self.client.put(
            f'/api/syllabus/{syllabus_id}',
            json={'description': 'Updated syllabus smoke test'},
        )
        self.assertEqual(syllabus_update.status_code, 200)

        curriculum_update = self.client.put(
            f'/api/curriculum/{curriculum_id}',
            json={'program': 'BSIT 2026 Revised Curriculum'},
        )
        self.assertEqual(curriculum_update.status_code, 200)

        lesson_update = self.client.put(
            f'/api/lessons/{lesson_id}',
            json={'title': 'Updated UX Introduction'},
        )
        self.assertEqual(lesson_update.status_code, 200)

        self.assertEqual(self.client.delete(f'/api/lessons/{lesson_id}').status_code, 200)
        self.assertEqual(self.client.delete(f'/api/curriculum/{curriculum_id}').status_code, 200)
        self.assertEqual(self.client.delete(f'/api/syllabus/{syllabus_id}').status_code, 200)


if __name__ == '__main__':
    unittest.main()
