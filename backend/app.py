import os
from datetime import datetime

from flask import Flask, jsonify
from flask_cors import CORS

from config import config
from models import db
from routes import (
    announcements,
    audit_logs,
    auth,
    curriculum,
    faculty,
    lessons,
    organizations,
    reports,
    research,
    schedules,
    sections,
    students,
    syllabus,
)


def create_app(config_overrides=None):
    app = Flask(__name__)
    override_env = (config_overrides or {}).get('ENV')
    configured_env = override_env or os.environ.get('FLASK_ENV') or 'development'
    env_name = 'production' if configured_env == 'production' else 'default'
    app.config.from_object(config[env_name])

    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    CORS(app)

    app.register_blueprint(auth.auth_bp)
    app.register_blueprint(students.students_bp)
    app.register_blueprint(faculty.faculty_bp)
    app.register_blueprint(schedules.schedules_bp)
    app.register_blueprint(sections.sections_bp)
    app.register_blueprint(announcements.announcements_bp)
    app.register_blueprint(audit_logs.audit_logs_bp)
    app.register_blueprint(research.research_bp)
    app.register_blueprint(reports.reports_bp)
    app.register_blueprint(organizations.organizations_bp)
    app.register_blueprint(syllabus.syllabus_bp)
    app.register_blueprint(curriculum.curriculum_bp)
    app.register_blueprint(lessons.lessons_bp)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat()
        })

    return app


app = create_app()


if __name__ == '__main__':
    port = app.config['PORT']
    app.run(host='0.0.0.0', port=port, debug=app.config['DEBUG'])


