import React, { memo } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { CORE_COURSES, TERM_SEMESTERS, YEAR_LEVELS } from '../../lib/formOptions';

const InstructionsForm = memo(({ activeTab, formData, setFormData, syllabi, onSubmit, onClose }) => {
  const updateListItem = (field, index, nextValue) => {
    setFormData((prev) => {
      const nextItems = [...(prev[field] || [])];
      nextItems[index] = nextValue;
      return { ...prev, [field]: nextItems };
    });
  };

  const addListItem = (field, template) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), template],
    }));
  };

  const removeListItem = (field, index) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addCurriculumTerm = () => {
    setFormData((prev) => ({
      ...prev,
      semesters: [
        ...(prev.semesters || []),
        {
          year_level: '1st Year',
          semester: '1st Semester',
          subjects: [],
        },
      ],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900">
            Add New {activeTab === 'syllabus' ? 'Syllabus' : activeTab === 'curriculum' ? 'Curriculum' : 'Lesson'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-6">
          {activeTab === 'syllabus' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Course *</label>
                  <select
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.course}
                    onChange={(event) => setFormData((prev) => ({ ...prev, course: event.target.value }))}
                  >
                    <option value="">Select Course</option>
                    {CORE_COURSES.map((course) => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Subject Code *</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.code}
                    onChange={(event) => setFormData((prev) => ({ ...prev, code: event.target.value }))}
                    placeholder="e.g. CCS101"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Subject *</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.subject}
                    onChange={(event) => setFormData((prev) => ({ ...prev, subject: event.target.value }))}
                    placeholder="e.g. Computer Programming 1"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Instructor *</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.instructor}
                    onChange={(event) => setFormData((prev) => ({ ...prev, instructor: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Semester *</label>
                  <select
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.semester}
                    onChange={(event) => setFormData((prev) => ({ ...prev, semester: event.target.value }))}
                  >
                    <option value="">Select Semester</option>
                    {TERM_SEMESTERS.map((semester) => (
                      <option key={semester} value={semester}>{semester}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Academic Year *</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.academic_year}
                    onChange={(event) => setFormData((prev) => ({ ...prev, academic_year: event.target.value }))}
                    placeholder="e.g. 2026-2027"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Units *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.units}
                    onChange={(event) => setFormData((prev) => ({ ...prev, units: parseInt(event.target.value, 10) || 0 }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Hours *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.hours}
                    onChange={(event) => setFormData((prev) => ({ ...prev, hours: parseInt(event.target.value, 10) || 0 }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    autoComplete="off"
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.description}
                    onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Course Objectives</label>
                  <button type="button" onClick={() => addListItem('objectives', '')} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-orange-700">
                    <Plus size={14} />
                    Add Objective
                  </button>
                </div>
                {(formData.objectives || []).map((objective, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      autoComplete="off"
                      className="flex-1 rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={objective}
                      onChange={(event) => updateListItem('objectives', index, event.target.value)}
                      placeholder="Learning objective"
                    />
                    <button type="button" onClick={() => removeListItem('objectives', index)} className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <label className="block text-sm font-medium text-gray-700">Course Topics</label>
                  <button type="button" onClick={() => addListItem('topics', { week: 1, topic: '', hours: 1 })} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-orange-700">
                    <Plus size={14} />
                    Add Topic
                  </button>
                </div>
                {(formData.topics || []).map((topic, index) => (
                  <div key={index} className="grid grid-cols-[90px_1fr_90px_auto] items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      className="rounded-xl border border-gray-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={topic.week}
                      onChange={(event) => updateListItem('topics', index, { ...topic, week: parseInt(event.target.value, 10) || 1 })}
                    />
                    <input
                      type="text"
                      autoComplete="off"
                      className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={topic.topic}
                      onChange={(event) => updateListItem('topics', index, { ...topic, topic: event.target.value })}
                      placeholder="Topic title"
                    />
                    <input
                      type="number"
                      min="1"
                      className="rounded-xl border border-gray-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={topic.hours}
                      onChange={(event) => updateListItem('topics', index, { ...topic, hours: parseInt(event.target.value, 10) || 1 })}
                    />
                    <button type="button" onClick={() => removeListItem('topics', index)} className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <label className="block text-sm font-medium text-gray-700">Grading Requirements</label>
                  <button type="button" onClick={() => addListItem('requirements', { type: '', weight: 0 })} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-orange-700">
                    <Plus size={14} />
                    Add Requirement
                  </button>
                </div>
                {(formData.requirements || []).map((requirement, index) => (
                  <div key={index} className="grid grid-cols-[1fr_110px_auto] items-center gap-2">
                    <input
                      type="text"
                      autoComplete="off"
                      className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={requirement.type}
                      onChange={(event) => updateListItem('requirements', index, { ...requirement, type: event.target.value })}
                      placeholder="Requirement type"
                    />
                    <input
                      type="number"
                      min="0"
                      className="rounded-xl border border-gray-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={requirement.weight}
                      onChange={(event) => updateListItem('requirements', index, { ...requirement, weight: parseInt(event.target.value, 10) || 0 })}
                    />
                    <button type="button" onClick={() => removeListItem('requirements', index)} className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {activeTab === 'curriculum' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Course *</label>
                  <select
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.course}
                    onChange={(event) => setFormData((prev) => ({ ...prev, course: event.target.value }))}
                  >
                    <option value="">Select Course</option>
                    {CORE_COURSES.map((course) => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Program *</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.program}
                    onChange={(event) => setFormData((prev) => ({ ...prev, program: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Curriculum Year *</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.year}
                    onChange={(event) => setFormData((prev) => ({ ...prev, year: event.target.value }))}
                    placeholder="e.g. 2018"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Total Units *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.total_units}
                    onChange={(event) => setFormData((prev) => ({ ...prev, total_units: parseInt(event.target.value, 10) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Year Level and Semester Blocks *</label>
                  <button type="button" onClick={addCurriculumTerm} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-orange-700">
                    <Plus size={14} />
                    Add Term
                  </button>
                </div>

                {(formData.semesters || []).map((term, termIndex) => (
                  <div key={termIndex} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
                      <select
                        required
                        className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                        value={term.year_level || '1st Year'}
                        onChange={(event) => {
                          const nextTerms = [...(formData.semesters || [])];
                          nextTerms[termIndex].year_level = event.target.value;
                          setFormData((prev) => ({ ...prev, semesters: nextTerms }));
                        }}
                      >
                        {YEAR_LEVELS.map((yearLevel) => (
                          <option key={yearLevel} value={yearLevel}>{yearLevel}</option>
                        ))}
                      </select>

                      <select
                        required
                        className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                        value={term.semester || '1st Semester'}
                        onChange={(event) => {
                          const nextTerms = [...(formData.semesters || [])];
                          nextTerms[termIndex].semester = event.target.value;
                          setFormData((prev) => ({ ...prev, semesters: nextTerms }));
                        }}
                      >
                        {TERM_SEMESTERS.map((semester) => (
                          <option key={semester} value={semester}>{semester}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeListItem('semesters', termIndex)}
                        className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {(term.subjects || []).map((subject, subjectIndex) => (
                        <div key={subjectIndex} className="grid grid-cols-[110px_1fr_90px_auto] items-center gap-2 rounded-xl bg-white p-2">
                          <input
                            type="text"
                            required
                            autoComplete="off"
                            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                            value={subject.code}
                            onChange={(event) => {
                              const nextTerms = [...(formData.semesters || [])];
                              nextTerms[termIndex].subjects[subjectIndex].code = event.target.value;
                              setFormData((prev) => ({ ...prev, semesters: nextTerms }));
                            }}
                            placeholder="Code"
                          />
                          <input
                            type="text"
                            required
                            autoComplete="off"
                            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                            value={subject.name}
                            onChange={(event) => {
                              const nextTerms = [...(formData.semesters || [])];
                              nextTerms[termIndex].subjects[subjectIndex].name = event.target.value;
                              setFormData((prev) => ({ ...prev, semesters: nextTerms }));
                            }}
                            placeholder="Subject name"
                          />
                          <input
                            type="number"
                            required
                            min="0"
                            autoComplete="off"
                            className="rounded-lg border border-gray-300 px-3 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                            value={subject.units}
                            onChange={(event) => {
                              const nextTerms = [...(formData.semesters || [])];
                              nextTerms[termIndex].subjects[subjectIndex].units = parseInt(event.target.value, 10) || 0;
                              setFormData((prev) => ({ ...prev, semesters: nextTerms }));
                            }}
                            placeholder="Units"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextTerms = [...(formData.semesters || [])];
                              nextTerms[termIndex].subjects = nextTerms[termIndex].subjects.filter((_, index) => index !== subjectIndex);
                              setFormData((prev) => ({ ...prev, semesters: nextTerms }));
                            }}
                            className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const nextTerms = [...(formData.semesters || [])];
                          if (!nextTerms[termIndex].subjects) {
                            nextTerms[termIndex].subjects = [];
                          }
                          nextTerms[termIndex].subjects.push({ code: '', name: '', units: 0 });
                          setFormData((prev) => ({ ...prev, semesters: nextTerms }));
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-gray-200 px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-300"
                      >
                        <Plus size={14} />
                        Add Subject
                      </button>
                    </div>
                  </div>
                ))}

                {(formData.semesters || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-400">
                    No curriculum terms added yet. Click "Add Term" to get started.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {activeTab === 'lessons' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Syllabus *</label>
                  <select
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.syllabus_id}
                    onChange={(event) => setFormData((prev) => ({ ...prev, syllabus_id: event.target.value }))}
                  >
                    <option value="">Select Syllabus</option>
                    {syllabi.map((syllabus) => (
                      <option key={syllabus.id} value={syllabus.id}>{syllabus.code} - {syllabus.subject}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Week *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.week}
                    onChange={(event) => setFormData((prev) => ({ ...prev, week: parseInt(event.target.value, 10) || 1 }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Title *</label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.title}
                    onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Duration</label>
                  <input
                    type="text"
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.duration}
                    onChange={(event) => setFormData((prev) => ({ ...prev, duration: event.target.value }))}
                    placeholder="e.g. 3 hours"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                  <select
                    autoComplete="off"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                    value={formData.type}
                    onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value }))}
                  >
                    <option value="Lecture">Lecture</option>
                    <option value="Laboratory">Laboratory</option>
                    <option value="Discussion">Discussion</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Lesson Objectives</label>
                  <button type="button" onClick={() => addListItem('objectives', '')} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-orange-700">
                    <Plus size={14} />
                    Add Objective
                  </button>
                </div>
                {(formData.objectives || []).map((objective, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      autoComplete="off"
                      className="flex-1 rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={objective}
                      onChange={(event) => updateListItem('objectives', index, event.target.value)}
                      placeholder="Lesson objective"
                    />
                    <button type="button" onClick={() => removeListItem('objectives', index)} className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <label className="block text-sm font-medium text-gray-700">Materials</label>
                  <button type="button" onClick={() => addListItem('materials', { name: '', type: '', size: '' })} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-orange-700">
                    <Plus size={14} />
                    Add Material
                  </button>
                </div>
                {(formData.materials || []).map((material, index) => (
                  <div key={index} className="grid grid-cols-[1fr_120px_110px_auto] items-center gap-2">
                    <input
                      type="text"
                      autoComplete="off"
                      className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={material.name}
                      onChange={(event) => updateListItem('materials', index, { ...material, name: event.target.value })}
                      placeholder="Material name"
                    />
                    <input
                      type="text"
                      autoComplete="off"
                      className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={material.type}
                      onChange={(event) => updateListItem('materials', index, { ...material, type: event.target.value })}
                      placeholder="Type"
                    />
                    <input
                      type="text"
                      autoComplete="off"
                      className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={material.size}
                      onChange={(event) => updateListItem('materials', index, { ...material, size: event.target.value })}
                      placeholder="Size"
                    />
                    <button type="button" onClick={() => removeListItem('materials', index)} className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <label className="block text-sm font-medium text-gray-700">Activities</label>
                  <button type="button" onClick={() => addListItem('activities', { name: '', dueDate: '', status: 'Pending' })} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-orange-700">
                    <Plus size={14} />
                    Add Activity
                  </button>
                </div>
                {(formData.activities || []).map((activity, index) => (
                  <div key={index} className="grid grid-cols-[1fr_140px_130px_auto] items-center gap-2">
                    <input
                      type="text"
                      autoComplete="off"
                      className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={activity.name}
                      onChange={(event) => updateListItem('activities', index, { ...activity, name: event.target.value })}
                      placeholder="Activity name"
                    />
                    <input
                      type="date"
                      className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={activity.dueDate}
                      onChange={(event) => updateListItem('activities', index, { ...activity, dueDate: event.target.value })}
                    />
                    <select
                      className="rounded-xl border border-gray-300 px-4 py-2 outline-none transition-all focus:ring-2 focus:ring-orange-500"
                      value={activity.status}
                      onChange={(event) => updateListItem('activities', index, { ...activity, status: event.target.value })}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <button type="button" onClick={() => removeListItem('activities', index)} className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 font-semibold text-white transition-colors hover:bg-orange-700"
            >
              <Save size={18} />
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-gray-200 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

InstructionsForm.displayName = 'InstructionsForm';

export default InstructionsForm;
