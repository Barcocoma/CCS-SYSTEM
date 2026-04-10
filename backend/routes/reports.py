from flask import Blueprint, request, jsonify
from audit import log_audit_event
from authz import require_roles
from models import db, Report, Student, Faculty, User
from datetime import datetime, timedelta
import csv
import io

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

@reports_bp.route('', methods=['GET'])
def get_reports():
    """Get all reports with optional filtering"""
    try:
        tenant_id = request.args.get('tenant_id')
        report_type = request.args.get('report_type')
        organization = request.args.get('organization')
        status = request.args.get('status')
        
        query = Report.query
        
        if tenant_id:
            query = query.filter(Report.tenant_id == tenant_id)
        if report_type:
            query = query.filter(Report.report_type == report_type)
        if organization:
            query = query.filter(Report.organization == organization)
        if status:
            query = query.filter(Report.status == status)
        
        reports = query.order_by(Report.date.desc()).all()
        
        return jsonify({
            'success': True,
            'data': [r.to_dict() for r in reports]
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('', methods=['POST'])
@require_roles(['DEAN', 'CHAIR', 'SECRETARY'])
def create_report():
    """Create a new report"""
    try:
        data = request.get_json() or {}
        
        # Validate required fields
        if 'title' not in data or not data['title']:
            return jsonify({
                'success': False,
                'message': 'title is required'
            }), 400
        
        if 'date' not in data or not data['date']:
            return jsonify({
                'success': False,
                'message': 'date is required'
            }), 400
        
        # Parse date
        try:
            report_date = datetime.fromisoformat(data['date'].replace('Z', '+00:00')).date()
        except:
            return jsonify({
                'success': False,
                'message': 'Invalid date format'
            }), 400
        
        report = Report(
            title=data['title'],
            report_type=data.get('report_type', 'event'),
            description=data.get('description'),
            organization=data.get('organization'),
            date=report_date,
            time=data.get('time'),
            venue=data.get('venue'),
            status=data.get('status', 'Upcoming'),
            participants=data.get('participants', 0),
            registered=data.get('registered', 0),
            category=data.get('category'),
            tenant_id=data.get('tenant_id')
        )
        
        db.session.add(report)
        db.session.commit()

        log_audit_event(
            action='CREATE',
            entity_type='EVENT',
            entity_id=report.id,
            entity_name=report.title,
            details={'report_type': report.report_type, 'organization': report.organization},
            tenant_id=report.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Report created successfully',
            'data': report.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('/<int:report_id>', methods=['GET'])
def get_report(report_id):
    """Get a specific report by ID"""
    try:
        report = Report.query.get(report_id)
        if not report:
            return jsonify({
                'success': False,
                'message': 'Report not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': report.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('/<int:report_id>', methods=['PUT'])
@require_roles(['DEAN', 'CHAIR', 'SECRETARY'])
def update_report(report_id):
    """Update a report"""
    try:
        report = Report.query.get(report_id)
        if not report:
            return jsonify({
                'success': False,
                'message': 'Report not found'
            }), 404
        
        data = request.get_json() or {}
        
        if 'title' in data:
            report.title = data['title']
        if 'report_type' in data:
            report.report_type = data['report_type']
        if 'description' in data:
            report.description = data['description']
        if 'organization' in data:
            report.organization = data['organization']
        if 'time' in data:
            report.time = data['time']
        if 'venue' in data:
            report.venue = data['venue']
        if 'status' in data:
            report.status = data['status']
        if 'participants' in data:
            report.participants = data['participants']
        if 'registered' in data:
            report.registered = data['registered']
        if 'category' in data:
            report.category = data['category']
        if 'date' in data and data['date']:
            try:
                report.date = datetime.fromisoformat(data['date'].replace('Z', '+00:00')).date()
            except Exception:
                return jsonify({
                    'success': False,
                    'message': 'Invalid date format'
                }), 400
        
        db.session.commit()

        log_audit_event(
            action='UPDATE',
            entity_type='EVENT',
            entity_id=report.id,
            entity_name=report.title,
            details={'report_type': report.report_type, 'status': report.status},
            tenant_id=report.tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Report updated successfully',
            'data': report.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('/<int:report_id>', methods=['DELETE'])
@require_roles(['DEAN'])
def delete_report(report_id):
    """Delete a report"""
    try:
        report = Report.query.get(report_id)
        if not report:
            return jsonify({
                'success': False,
                'message': 'Report not found'
            }), 404
        
        tenant_id = report.tenant_id
        title = report.title
        db.session.delete(report)
        db.session.commit()

        log_audit_event(
            action='DELETE',
            entity_type='EVENT',
            entity_id=report_id,
            entity_name=title,
            tenant_id=tenant_id,
        )
        
        return jsonify({
            'success': True,
            'message': 'Report deleted successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('/overview', methods=['GET'])
@require_roles(['DEAN'])
def get_overview_report():
    """Get system overview report for admin dashboard"""
    try:
        tenant_id = request.args.get('tenant_id')

        # Get total counts
        total_students = Student.query.count()
        total_faculty = Faculty.query.count()
        total_events = Report.query.filter(Report.report_type == 'event').count()

        # Get recent activity (last 30 days)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        recent_students = Student.query.filter(Student.created_at >= thirty_days_ago).count()
        recent_events = Report.query.filter(
            Report.created_at >= thirty_days_ago,
            Report.report_type == 'event'
        ).count()

        # Get upcoming events
        now = datetime.now()
        upcoming_events = Report.query.filter(
            Report.date >= now.date(),
            Report.report_type == 'event'
        ).order_by(Report.date).limit(5).all()

        # Mock recent activity data (in a real app, this would come from audit logs)
        recent_activity = [
            {
                'description': f'New student registered',
                'timestamp': (datetime.now() - timedelta(hours=2)).isoformat(),
                'type': 'student'
            },
            {
                'description': f'Event "{upcoming_events[0].title if upcoming_events else "Sample Event"}" created',
                'timestamp': (datetime.now() - timedelta(hours=5)).isoformat(),
                'type': 'event'
            },
            {
                'description': f'Faculty profile updated',
                'timestamp': (datetime.now() - timedelta(hours=8)).isoformat(),
                'type': 'faculty'
            }
        ]

        return jsonify({
            'success': True,
            'data': {
                'stats': {
                    'totalStudents': total_students,
                    'totalFaculty': total_faculty,
                    'totalEvents': total_events,
                    'newStudents': recent_students,
                    'upcomingEvents': len(upcoming_events)
                },
                'recentActivity': recent_activity,
                'upcomingEvents': [r.to_dict() for r in upcoming_events]
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('/system', methods=['GET'])
@require_roles(['DEAN'])
def get_system_report():
    """Get system performance and health report"""
    try:
        # Mock system metrics (in a real app, these would be actual system metrics)
        system_data = {
            'uptime': '99.9%',
            'responseTime': '120ms',
            'activeUsers': User.query.count(),
            'totalRequests': 15420,  # Mock data
            'errorRate': '0.1%',
            'databaseConnections': 12,
            'memoryUsage': '68%',
            'diskUsage': '45%'
        }

        return jsonify({
            'success': True,
            'data': system_data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@reports_bp.route('/export', methods=['GET'])
@require_roles(['DEAN'])
def export_report():
    """Export report data in CSV or other formats"""
    try:
        report_type = request.args.get('type', 'students')
        format_type = request.args.get('format', 'csv')
        period = request.args.get('period', '30d')

        # Calculate date range
        now = datetime.now()
        if period == '7d':
            start_date = now - timedelta(days=7)
        elif period == '30d':
            start_date = now - timedelta(days=30)
        elif period == '90d':
            start_date = now - timedelta(days=90)
        elif period == '1y':
            start_date = now - timedelta(days=365)
        else:
            start_date = None

        if format_type == 'csv':
            # Create CSV data
            output = io.StringIO()
            writer = csv.writer(output)

            if report_type == 'students':
                writer.writerow(['Student ID', 'Name', 'Course', 'Year Level', 'Email', 'Status', 'Enrolled Date'])

                query = Student.query
                if start_date:
                    query = query.filter(Student.created_at >= start_date)

                students = query.all()
                for student in students:
                    full_name = ' '.join(filter(None, [student.first_name, student.middle_name, student.last_name]))
                    writer.writerow([
                        student.student_id,
                        full_name,
                        student.course,
                        student.year_level,
                        student.email,
                        student.enrollment_status or 'Active',
                        student.created_at.strftime('%Y-%m-%d') if student.created_at else ''
                    ])

            elif report_type == 'faculty':
                writer.writerow(['Faculty ID', 'Name', 'Department', 'Email', 'Status', 'Joined Date'])

                query = Faculty.query
                if start_date:
                    query = query.filter(Faculty.created_at >= start_date)

                faculty = query.all()
                for fac in faculty:
                    full_name = ' '.join(filter(None, [fac.first_name, fac.middle_name, fac.last_name]))
                    writer.writerow([
                        fac.employee_number,
                        full_name,
                        fac.department,
                        fac.email,
                        fac.employment_status or 'Active',
                        fac.created_at.strftime('%Y-%m-%d') if fac.created_at else ''
                    ])

            elif report_type == 'events':
                writer.writerow(['Event Title', 'Organization', 'Date', 'Time', 'Venue', 'Status', 'Participants', 'Registered'])

                query = Report.query.filter(Report.report_type == 'event')
                if start_date:
                    query = query.filter(Report.created_at >= start_date)

                events = query.all()
                for event in events:
                    writer.writerow([
                        event.title,
                        event.organization,
                        event.date.strftime('%Y-%m-%d') if event.date else '',
                        event.time,
                        event.venue,
                        event.status,
                        event.participants,
                        event.registered
                    ])
            
            elif report_type == 'system':
                # System report with metrics
                writer.writerow(['Metric', 'Value', 'Last Updated'])
                
                total_students = Student.query.count()
                total_faculty = Faculty.query.count()
                total_events = Report.query.filter(Report.report_type == 'event').count()
                total_users = User.query.count()
                
                writer.writerow(['Total Students', total_students, now.strftime('%Y-%m-%d %H:%M:%S')])
                writer.writerow(['Total Faculty', total_faculty, now.strftime('%Y-%m-%d %H:%M:%S')])
                writer.writerow(['Total Events', total_events, now.strftime('%Y-%m-%d %H:%M:%S')])
                writer.writerow(['Total Users', total_users, now.strftime('%Y-%m-%d %H:%M:%S')])

            csv_data = output.getvalue()
            output.close()

            return csv_data, 200, {
                'Content-Type': 'text/csv',
                'Content-Disposition': f'attachment; filename={report_type}-report-{now.strftime("%Y%m%d")}.csv'
            }

        else:
            # For other formats, return JSON data for frontend to handle
            data = []
            
            if report_type == 'students':
                query = Student.query
                if start_date:
                    query = query.filter(Student.created_at >= start_date)
                
                students = query.all()
                data = [{
                    'Student ID': s.student_id,
                    'Name': ' '.join(filter(None, [s.first_name, s.middle_name, s.last_name])),
                    'Course': s.course,
                    'Year Level': s.year_level,
                    'Email': s.email,
                    'Status': s.enrollment_status or 'Active',
                    'Enrolled Date': s.created_at.strftime('%Y-%m-%d') if s.created_at else ''
                } for s in students]
            
            elif report_type == 'faculty':
                query = Faculty.query
                if start_date:
                    query = query.filter(Faculty.created_at >= start_date)
                
                faculty = query.all()
                data = [{
                    'Faculty ID': f.employee_number,
                    'Name': ' '.join(filter(None, [f.first_name, f.middle_name, f.last_name])),
                    'Department': f.department,
                    'Email': f.email,
                    'Status': f.employment_status or 'Active',
                    'Joined Date': f.created_at.strftime('%Y-%m-%d') if f.created_at else ''
                } for f in faculty]
            
            elif report_type == 'events':
                query = Report.query.filter(Report.report_type == 'event')
                if start_date:
                    query = query.filter(Report.created_at >= start_date)
                
                events = query.all()
                data = [{
                    'Event Title': e.title,
                    'Organization': e.organization,
                    'Date': e.date.strftime('%Y-%m-%d') if e.date else '',
                    'Time': e.time,
                    'Venue': e.venue,
                    'Status': e.status,
                    'Participants': e.participants,
                    'Registered': e.registered
                } for e in events]
            
            return jsonify({
                'success': True,
                'format': format_type,
                'report_type': report_type,
                'data': data
            }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
