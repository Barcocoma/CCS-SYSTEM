from app import app
from models import db
from seeds import seed_demo_data


def init_database():
    """Initialize Firestore collections and demo data."""
    with app.app_context():
        try:
            db.create_all()
            seed_demo_data()
            db.session.commit()
            print("Firestore collections initialized successfully.")
            print("Demo accounts (password: admin123):")
            print("- admin@example.com (DEAN)")
            print("- chair@example.com (CHAIR)")
            print("- faculty@example.com (FACULTY)")
            print("- secretary@example.com (SECRETARY)")
            print("Demo records seeded for students, faculty, schedules, events, research, and instructions.")
        except Exception as exc:
            db.session.rollback()
            print(f"Error initializing database: {exc}")
            print("Make sure Firebase credentials and Firestore settings are configured correctly.")


if __name__ == '__main__':
    init_database()
