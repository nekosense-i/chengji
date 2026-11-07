// Grade aggregates should include every valid score in the exam cohort.
// Individual student access remains governed by Utils.isActualScore.
Utils.isValidGradeAggregateScore = (record, exam = null) => {
    const data = window.app?.store?.state?.data;
    exam ||= data?.exams.find(e => e.id === record?.examId);
    if (!record || !exam || !window.gk2Statistics.inspect(record, exam).included) return false;

    const student = data?.students.find(s => s.id === (record.studentId || record.id));
    if (!student || student.grade !== exam.grade || !Utils.isStudentInExam(student, exam)) return false;

    const position = Utils.getClassForExam(student, exam);
    const campuses = exam.campuses?.length ? exam.campuses : exam.campus ? [exam.campus] : [];
    return !campuses.length || campuses.includes(position.campus);
};
