export function getInitials(...parts) {
  const tokens = parts
    .flat()
    .filter(Boolean)
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return tokens
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() || '')
    .join('') || 'NA';
}

export function formatPersonName(person = {}) {
  return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
}

export function formatFacultyLabel(faculty = {}) {
  const name = formatPersonName(faculty).replace(/\s+/g, ' ').trim();
  const positionPrefix = faculty.position ? `${faculty.position} ` : '';
  const employeeSuffix = faculty.employee_number ? ` (${faculty.employee_number})` : '';
  return `${positionPrefix}${name}${employeeSuffix}`.trim();
}

export function parseOptionalJson(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function matchesFacultyAssignment(schedule, faculty) {
  if (!schedule || !faculty) {
    return false;
  }

  const instructor = (schedule.instructor || '').toLowerCase();
  const employeeNumber = (faculty.employee_number || '').toLowerCase();
  const nameTokens = [faculty.first_name, faculty.middle_name, faculty.last_name]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  if (employeeNumber && instructor.includes(employeeNumber)) {
    return true;
  }

  return nameTokens.every((token) => instructor.includes(token));
}

