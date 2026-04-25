from __future__ import annotations

import copy

COURSE_OPTIONS = ("BSIT", "BSCS")
YEAR_LEVEL_OPTIONS = ("1st Year", "2nd Year", "3rd Year", "4th Year")
SEMESTER_OPTIONS = ("1st Semester", "2nd Semester")
DEFAULT_CURRICULUM_YEAR = "2018"
DEFAULT_SECTION_NAMES = ("A", "B", "C")
SECTION_CAPACITY = 50

ROOM_POOLS = {
    "CLASSROOM": (
        "Room 101",
        "Room 102",
        "Room 103",
        "Room 104",
        "Room 105",
        "Room 106",
        "Room 107",
        "Room 108",
    ),
    "LAB": (
        "Lab 201",
        "Lab 202",
        "Lab 203",
        "Lab 204",
        "Networking Lab 301",
        "Networking Lab 302",
    ),
    "ACTIVITY": (
        "Gym 1",
        "Gym 2",
        "Field 1",
        "Field 2",
    ),
}

TIME_BLOCKS = (
    {"day": "Monday", "start_time": "7:00 AM", "end_time": "9:00 AM"},
    {"day": "Monday", "start_time": "9:00 AM", "end_time": "11:00 AM"},
    {"day": "Monday", "start_time": "11:00 AM", "end_time": "1:00 PM"},
    {"day": "Monday", "start_time": "1:00 PM", "end_time": "3:00 PM"},
    {"day": "Monday", "start_time": "3:00 PM", "end_time": "5:00 PM"},
    {"day": "Monday", "start_time": "5:00 PM", "end_time": "7:00 PM"},
    {"day": "Tuesday", "start_time": "7:00 AM", "end_time": "9:00 AM"},
    {"day": "Tuesday", "start_time": "9:00 AM", "end_time": "11:00 AM"},
    {"day": "Tuesday", "start_time": "11:00 AM", "end_time": "1:00 PM"},
    {"day": "Tuesday", "start_time": "1:00 PM", "end_time": "3:00 PM"},
    {"day": "Tuesday", "start_time": "3:00 PM", "end_time": "5:00 PM"},
    {"day": "Tuesday", "start_time": "5:00 PM", "end_time": "7:00 PM"},
    {"day": "Wednesday", "start_time": "7:00 AM", "end_time": "9:00 AM"},
    {"day": "Wednesday", "start_time": "9:00 AM", "end_time": "11:00 AM"},
    {"day": "Wednesday", "start_time": "11:00 AM", "end_time": "1:00 PM"},
    {"day": "Wednesday", "start_time": "1:00 PM", "end_time": "3:00 PM"},
    {"day": "Wednesday", "start_time": "3:00 PM", "end_time": "5:00 PM"},
    {"day": "Wednesday", "start_time": "5:00 PM", "end_time": "7:00 PM"},
    {"day": "Thursday", "start_time": "7:00 AM", "end_time": "9:00 AM"},
    {"day": "Thursday", "start_time": "9:00 AM", "end_time": "11:00 AM"},
    {"day": "Thursday", "start_time": "11:00 AM", "end_time": "1:00 PM"},
    {"day": "Thursday", "start_time": "1:00 PM", "end_time": "3:00 PM"},
    {"day": "Thursday", "start_time": "3:00 PM", "end_time": "5:00 PM"},
    {"day": "Thursday", "start_time": "5:00 PM", "end_time": "7:00 PM"},
    {"day": "Friday", "start_time": "7:00 AM", "end_time": "9:00 AM"},
    {"day": "Friday", "start_time": "9:00 AM", "end_time": "11:00 AM"},
    {"day": "Friday", "start_time": "11:00 AM", "end_time": "1:00 PM"},
    {"day": "Friday", "start_time": "1:00 PM", "end_time": "3:00 PM"},
    {"day": "Friday", "start_time": "3:00 PM", "end_time": "5:00 PM"},
    {"day": "Friday", "start_time": "5:00 PM", "end_time": "7:00 PM"},
    {"day": "Saturday", "start_time": "7:00 AM", "end_time": "9:00 AM"},
    {"day": "Saturday", "start_time": "9:00 AM", "end_time": "11:00 AM"},
    {"day": "Saturday", "start_time": "11:00 AM", "end_time": "1:00 PM"},
    {"day": "Saturday", "start_time": "1:00 PM", "end_time": "3:00 PM"},
    {"day": "Saturday", "start_time": "3:00 PM", "end_time": "5:00 PM"},
    {"day": "Saturday", "start_time": "5:00 PM", "end_time": "7:00 PM"},
)


def _subject(code, name, units, room_preference="CLASSROOM", prerequisites=None):
    return {
        "code": code,
        "name": name,
        "units": units,
        "room_preference": room_preference,
        "prerequisites": prerequisites or [],
    }


def _term(year_level, semester, subjects):
    total_units = sum(subject["units"] for subject in subjects)
    return {
        "year_level": year_level,
        "semester": semester,
        "term_label": f"{year_level} - {semester}",
        "total_units": total_units,
        "subjects": subjects,
    }


DEFAULT_CURRICULA = {
    "BSIT": {
        "course": "BSIT",
        "program": "Bachelor of Science in Information Technology",
        "year": DEFAULT_CURRICULUM_YEAR,
        "semesters": [
            _term(
                "1st Year",
                "1st Semester",
                [
                    _subject("CCS101", "Introduction to Computing", 3, "LAB"),
                    _subject("CCS102", "Computer Programming 1", 3, "LAB"),
                    _subject("ETH101", "Ethics", 3),
                    _subject("MAT101", "Mathematics in the Modern World", 3),
                    _subject("NSTP1", "National Service Training Program 1", 3, "ACTIVITY"),
                    _subject("PED101", "Physical Education 1", 2, "ACTIVITY"),
                    _subject("PSY100", "Understanding the Self", 3),
                ],
            ),
            _term(
                "1st Year",
                "2nd Semester",
                [
                    _subject("CCS103", "Computer Programming 2", 3, "LAB", ["CCS102"]),
                    _subject("CCS104", "Discrete Structures 1", 3, "CLASSROOM", ["MAT101"]),
                    _subject("CCS105", "Human Computer Interaction 1", 3, "LAB", ["CCS101"]),
                    _subject("CCS106", "Social and Professional Issues", 3, "CLASSROOM", ["ETH101"]),
                    _subject("COM101", "Purposive Communication", 3),
                    _subject("GAD101", "Gender and Development", 3),
                    _subject("NSTP2", "National Service Training Program 2", 3, "ACTIVITY", ["NSTP1"]),
                    _subject("PED102", "Physical Education 2", 2, "ACTIVITY", ["PED101"]),
                ],
            ),
            _term(
                "2nd Year",
                "1st Semester",
                [
                    _subject("ACT101", "Principles of Accounting", 3),
                    _subject("CCS107", "Data Structures and Algorithms 1", 3, "LAB", ["CCS103"]),
                    _subject("CCS108", "Object-Oriented Programming", 3, "LAB", ["CCS103"]),
                    _subject("CCS109", "System Analysis and Design", 3, "LAB", ["CCS101"]),
                    _subject("ITEW1", "Electronic Commerce", 3, "LAB"),
                    _subject("PED103", "Physical Education 3", 2, "ACTIVITY", ["PED102"]),
                    _subject("STS101", "Science, Technology and Society", 3),
                ],
            ),
            _term(
                "2nd Year",
                "2nd Semester",
                [
                    _subject("CCS110", "Information Management 1", 3, "LAB", ["CCS101"]),
                    _subject("CCS111", "Networking and Communication 1", 3, "LAB", ["CCS103", "CCS104", "CCS105", "CCS106"]),
                    _subject("ENT101", "The Entrepreneurial Mind", 3),
                    _subject("ITEW2", "Client Side Scripting", 3, "LAB", ["ITEW1"]),
                    _subject("ITP101", "Quantitative Methods", 3, "CLASSROOM", ["CCS104"]),
                    _subject("ITP102", "Integrative Programming and Technologies", 3, "LAB", ["CCS109"]),
                    _subject("PED104", "Physical Education 4", 2, "ACTIVITY", ["PED103"]),
                ],
            ),
            _term(
                "3rd Year",
                "1st Semester",
                [
                    _subject("HIS101", "Readings in Philippine History", 3),
                    _subject("ITEW3", "Server Side Scripting", 3, "LAB", ["ITEW2"]),
                    _subject("ITP103", "System Integration and Architecture", 3, "LAB", ["ITP102"]),
                    _subject("ITP104", "Information Management 2", 3, "LAB", ["CCS110"]),
                    _subject("ITP105", "Networking and Communication 2", 3, "LAB", ["CCS111"]),
                    _subject("ITP106", "Human Computer Interaction 2", 3, "LAB", ["CCS105"]),
                    _subject("SOC101", "The Contemporary World", 3),
                    _subject("TEC101", "Technopreneurship", 3, "CLASSROOM", ["ENT101"]),
                ],
            ),
            _term(
                "3rd Year",
                "2nd Semester",
                [
                    _subject("CCS112", "Applications Development and Emerging Technologies", 3, "LAB", ["CCS103"]),
                    _subject("CCS113", "Information Assurance and Security", 3, "LAB", ["3rd Year Standing"]),
                    _subject("HMN101", "Art Appreciation", 3),
                    _subject("ITEW4", "Responsive Web Design", 3, "LAB", ["ITEW3"]),
                    _subject("ITP107", "Mobile Application Development", 3, "LAB", ["CCS108"]),
                    _subject("ITP108", "Capstone Project 1", 3, "LAB", ["ITP104", "CCS108", "ITP103", "ITP105", "ITP106", "ITEW3"]),
                    _subject("ITP109", "Platform Technologies", 3, "LAB", ["ITP106"]),
                ],
            ),
            _term(
                "4th Year",
                "1st Semester",
                [
                    _subject("ENV101", "Environmental Science", 3),
                    _subject("ITEW5", "Web Security and Optimization", 3, "LAB", ["ITEW4"]),
                    _subject("ITP110", "Web Technologies", 3, "LAB", ["ITP106"]),
                    _subject("ITP111", "System Administration and Maintenance", 3, "LAB", ["ITP105", "ITP109"]),
                    _subject("ITP112", "Capstone Project 2", 3, "LAB", ["ITP108"]),
                    _subject("RIZ101", "Life and Works of Rizal", 3),
                ],
            ),
            _term(
                "4th Year",
                "2nd Semester",
                [
                    _subject("ITEW6", "Web Development Frameworks", 3, "LAB", ["ITEW5"]),
                    _subject("ITP113", "IT Practicum (500 hours)", 9, "LAB", ["ITP108"]),
                ],
            ),
        ],
    },
    "BSCS": {
        "course": "BSCS",
        "program": "Bachelor of Science in Computer Science",
        "year": DEFAULT_CURRICULUM_YEAR,
        "semesters": [
            _term(
                "1st Year",
                "1st Semester",
                [
                    _subject("CCS101", "Introduction to Computing", 3, "LAB"),
                    _subject("CSC101", "Computer Programming 1", 3, "LAB"),
                    _subject("ETH101", "Ethics", 3),
                    _subject("MAT101", "Mathematics in the Modern World", 3),
                    _subject("NSTP1", "National Service Training Program 1", 3, "ACTIVITY"),
                    _subject("PED101", "Physical Education 1", 2, "ACTIVITY"),
                    _subject("PSY100", "Understanding the Self", 3),
                ],
            ),
            _term(
                "1st Year",
                "2nd Semester",
                [
                    _subject("CSC102", "Computer Programming 2", 3, "LAB", ["CSC101"]),
                    _subject("CSC103", "Discrete Structures 1", 3, "CLASSROOM", ["MAT101"]),
                    _subject("CSC104", "Introduction to Data Science", 3, "LAB"),
                    _subject("COM101", "Purposive Communication", 3),
                    _subject("GAD101", "Gender and Development", 3),
                    _subject("NSTP2", "National Service Training Program 2", 3, "ACTIVITY", ["NSTP1"]),
                    _subject("PED102", "Physical Education 2", 2, "ACTIVITY", ["PED101"]),
                    _subject("SOC100", "Readings in Philippine History", 3),
                ],
            ),
            _term(
                "2nd Year",
                "1st Semester",
                [
                    _subject("CSC201", "Data Structures and Algorithms", 3, "LAB", ["CSC102"]),
                    _subject("CSC202", "Object-Oriented Programming", 3, "LAB", ["CSC102"]),
                    _subject("CSC203", "Calculus for Computer Science", 3, "CLASSROOM"),
                    _subject("CSC204", "Computer Architecture and Organization", 3, "LAB"),
                    _subject("STS101", "Science, Technology and Society", 3),
                    _subject("PED103", "Physical Education 3", 2, "ACTIVITY", ["PED102"]),
                    _subject("SOC101", "The Contemporary World", 3),
                ],
            ),
            _term(
                "2nd Year",
                "2nd Semester",
                [
                    _subject("CSC205", "Algorithms and Complexity", 3, "LAB", ["CSC201"]),
                    _subject("CSC206", "Information Management", 3, "LAB", ["CSC202"]),
                    _subject("CSC207", "Operating Systems", 3, "LAB", ["CSC204"]),
                    _subject("CSC208", "Discrete Structures 2", 3, "CLASSROOM", ["CSC103"]),
                    _subject("ENT101", "The Entrepreneurial Mind", 3),
                    _subject("PED104", "Physical Education 4", 2, "ACTIVITY", ["PED103"]),
                    _subject("HMN101", "Art Appreciation", 3),
                ],
            ),
            _term(
                "3rd Year",
                "1st Semester",
                [
                    _subject("CSC301", "Design and Analysis of Algorithms", 3, "LAB", ["CSC205"]),
                    _subject("CSC302", "Programming Languages", 3, "LAB", ["CSC202"]),
                    _subject("CSC303", "Automata Theory and Formal Languages", 3, "CLASSROOM", ["CSC208"]),
                    _subject("CSC304", "Software Engineering", 3, "LAB", ["CSC206"]),
                    _subject("CSC305", "Computer Networks", 3, "LAB", ["CSC207"]),
                    _subject("RIZ101", "Life and Works of Rizal", 3),
                    _subject("TEC101", "Technopreneurship", 3, "CLASSROOM", ["ENT101"]),
                ],
            ),
            _term(
                "3rd Year",
                "2nd Semester",
                [
                    _subject("CSC306", "Artificial Intelligence", 3, "LAB", ["CSC301"]),
                    _subject("CSC307", "Human Computer Interaction", 3, "LAB", ["CSC304"]),
                    _subject("CSC308", "Compiler Design", 3, "LAB", ["CSC303", "CSC302"]),
                    _subject("CSC309", "Parallel and Distributed Computing", 3, "LAB", ["CSC305"]),
                    _subject("CSC310", "Research Methods in Computing", 3, "CLASSROOM"),
                    _subject("ENV101", "Environmental Science", 3),
                    _subject("SOC102", "Philippine Popular Culture", 3),
                ],
            ),
            _term(
                "4th Year",
                "1st Semester",
                [
                    _subject("CSC401", "Machine Learning", 3, "LAB", ["CSC306"]),
                    _subject("CSC402", "Intelligent Systems", 3, "LAB", ["CSC306"]),
                    _subject("CSC403", "Thesis 1", 3, "LAB", ["CSC310"]),
                    _subject("CSC404", "Information Assurance and Security", 3, "LAB", ["CSC305"]),
                    _subject("CSC405", "Software Quality Assurance", 3, "LAB", ["CSC304"]),
                    _subject("HUM102", "People and the Earth's Ecosystem", 3),
                ],
            ),
            _term(
                "4th Year",
                "2nd Semester",
                [
                    _subject("CSC406", "Thesis 2", 3, "LAB", ["CSC403"]),
                    _subject("CSC407", "CS Practicum (500 hours)", 9, "LAB", ["CSC403"]),
                    _subject("CSC408", "Emerging Technologies in Computer Science", 3, "LAB", ["CSC402"]),
                ],
            ),
        ],
    },
}


def get_default_curriculum(course):
    payload = DEFAULT_CURRICULA.get((course or "").strip().upper())
    return copy.deepcopy(payload) if payload else None
