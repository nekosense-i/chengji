(() => {
    const scopeFields = ['campus', 'grade', 'teachingClass'];
    const profileFields = ['name', ...scopeFields, 'adminClass'];
    const scopeKey = record => JSON.stringify(scopeFields.map(field => record[field]));
    const studentPath = (record, property) => [record.classId, 'students', record.id, ...(property ? [property] : [])];
    const assertField = (field, allowed) => {
        if (!allowed.includes(field)) throw Error('该字段不属于共享名单。');
    };
    const value = data => data === undefined ? { exists: false } : { exists: true, value: data };
    const change = (path, before, after) => ({ path, before: value(before), after: value(after) });

    function directoryIndex(directory) {
        if (directory?.user?.role !== 'admin' || !directory.classes || !directory.epochs) throw Error('需要完整的云端管理员名单。');
        const groups = new Map(), students = new Map();
        for (const { info, students: members } of Object.values(directory.classes)) {
            const key = scopeKey(info);
            if (groups.has(key)) throw Error('云端存在重复的班级。');
            groups.set(key, info);
            for (const member of Object.values(members)) {
                const { gakutenId, ...fields } = member;
                if (!gakutenId || students.has(gakutenId)) throw Error('云端学生 ID 对照有重复或缺失。');
                students.set(gakutenId, fields);
            }
        }
        return {groups, students};
    }

    function makeChanges(directory, command) {
        const {groups, students} = directoryIndex(directory);
        if (command.kind === 'set-category') {
            const room = groups.get(scopeKey(command));
            if (!room) throw Error('教学班已变化，请重新打开编辑。');
            if (!['gaokao','study-abroad',''].includes(command.category)) throw Error('教学类别无效。');
            return room.teachingCategory === command.category ? [] :
                [change([room.id,'info','teachingCategory'],room.teachingCategory,command.category)];
        }
        if (command.kind === 'archive-many') {
            return [...new Set(command.gakutenIds)].map(id=>{
                const student = students.get(id);
                if (!student) throw Error('所选学生已不在共享名单，请刷新后重试。');
                return change(studentPath(student),student,undefined);
            });
        }
        if (command.kind === 'rename-group') {
            const {field,original,name,campus,grade} = command;
            assertField(field,scopeFields);
            if (name === original) return [];
            const selected = Object.values(directory.classes).filter(({info})=>info[field]===original &&
                (field==='campus' || info.campus===campus) &&
                (field!=='teachingClass' || info.grade===grade));
            if (!selected.length || !name) throw Error('教学分组已变化，请刷新后检查。');
            const rename = {field,original,name,campus,grade,id:command.operationId,at:Date.now()};
            return selected.flatMap(room=>{
                const {info} = room, renamed = {...info,[field]:name};
                if (groups.has(scopeKey(renamed))) throw Error('已有同名教学班。');
                return [
                    change([info.id,'info',field],original,name),
                    change([info.id,'info','gakutenScopeRenames'],info.gakutenScopeRenames,[...(info.gakutenScopeRenames || []),rename]),
                    ...Object.values(room.students).map(student=>change(studentPath(student,field),original,name))
                ];
            });
        }

        if (command.kind === 'add') {
            const profile = Object.fromEntries(profileFields.map(field=>[field,command.profile[field] || '']));
            const group = groups.get(scopeKey(profile));
            const id = command.studentId;
            if (typeof id !== 'string' || !id) throw Error('缺少稳定的学生编号。');
            if ([...students.values()].some(record=>scopeKey(record)===scopeKey(profile) && record.name===profile.name)) throw Error('该班学生名单已有同名记录，请先核对身份。');
            const classId = group?.id || command.classId;
            if (typeof classId !== 'string' || !classId) throw Error('缺少稳定的班级编号。');
            const [campus,grade,teachingClass] = scopeFields.map(field=>profile[field]);
            const record = { ...profile,id,classId,tags:[],avatar:'' };
            return group
                ? [change(studentPath(record),undefined,record)]
                : [change([classId],undefined,{info:{id:classId,campus,grade,teachingClass,name:campus+' '+teachingClass},students:{[id]:record}})];
        }

        if (command.kind === 'edit-many') {
            const updates = Object.entries(command.fields);
            updates.forEach(([field])=>assertField(field,profileFields));
            return [...new Set(command.gakutenIds)].flatMap(id=>{
                const student = students.get(id);
                if (!student) throw Error('所选学生已不在共享名单，请刷新后重试。');
                const next = {...student,...command.fields};
                if (scopeKey(next) === scopeKey(student)) {
                    return updates.filter(([field,value])=>student[field]!==value)
                        .map(([field,value])=>change(studentPath(student,field),student[field],value));
                }
                const destination = groups.get(scopeKey(next));
                if (!destination) throw Error('请先建立目标班级。');
                next.classId = destination.id;
                return [change(studentPath(student),student,undefined),change(studentPath(next),undefined,next)];
            });
        }
        const student = students.get(command.gakutenId);
        if (!student) throw Error('该学生已不在共享名单。');
        if (command.kind === 'archive') return [change(studentPath(student),student,undefined)];
        if (command.kind !== 'edit') throw Error('不支持的名单操作。');
        assertField(command.field,profileFields);
        const next = { ...student, [command.field]:command.value };
        if (student[command.field] === command.value) return [];
        if (scopeKey(next) === scopeKey(student)) {
            return [change(studentPath(student,command.field),student[command.field],command.value)];
        }
        const destination = groups.get(scopeKey(next));
        if (!destination) throw Error('请先建立目标班级。');
        next.classId = destination.id;
        return [change(studentPath(student),student,undefined),change(studentPath(next),undefined,next)];
    }

    function project(directory, data, { timestamp, effectiveDate, participates }) {
        const {students,groups} = directoryIndex(directory);
        const changed = [];
        const existing = new Map(data.students.map(student=>[student.id,student]));
        const gradeChanges = [];
        for (const [id, record] of students) {
            const previous = existing.get(id);
            const profile = Object.fromEntries(profileFields.map(field=>[field,record[field] ?? '']));
            const history = structuredClone(previous?.classHistory || []);
            const oldMembership = previous?.rosterMembership;
            const next = { ...previous, ...profile, id };
            next.sharedClassId = groups.get(scopeKey(profile))?.id;
            if (previous && previous.grade !== profile.grade &&
                data.exams.some(exam=>participates(previous,exam))) {
                gradeChanges.push(id);
                continue;
            }
            const place = {campus:profile.campus,teachingClass:profile.teachingClass,from:effectiveDate,to:null};
            if (!previous) {
                next.classHistory = [place];
                next.rosterMembership = {version:1,archivedAt:null,includedExamIds:[],excludedExamIds:data.exams.map(exam=>exam.id)};
            } else if (previous.campus !== profile.campus || previous.teachingClass !== profile.teachingClass) {
                if (!history.length) history.push({campus:previous.campus,teachingClass:previous.teachingClass,from:'2000-01-01',to:null});
                const last = history.at(-1);
                if (last.from >= effectiveDate) history[history.length-1] = {...place,from:last.from};
                else {
                    last.to = new Date(Date.parse(effectiveDate)-86400000).toISOString().slice(0,10);
                    history.push(place);
                }
                next.classHistory = history;
            }
            if (oldMembership?.archivedAt != null) {
                const included = oldMembership.includedExamIds;
                next.rosterMembership = {version:1,archivedAt:null,includedExamIds:included,
                    excludedExamIds:data.exams.filter(exam=>!included.includes(exam.id)).map(exam=>exam.id)};
            }
            if (!previous || previous.sharedClassId !== next.sharedClassId || profileFields.some(field=>next[field]!==previous[field]) || oldMembership?.archivedAt != null) {
                changed.push({...next,_ts:Math.max(timestamp,(previous?._ts || 0)+1)});
            }
        }
        const scoreExams = new Map();
        for (const score of data.scores) {
            if (!scoreExams.has(score.studentId)) scoreExams.set(score.studentId,new Set());
            scoreExams.get(score.studentId).add(score.examId);
        }
        for (const previous of existing.values()) {
            if (students.has(previous.id) || previous.rosterMembership?.archivedAt != null) continue;
            const included = new Set(data.exams.filter(exam=>participates(previous,exam)).map(exam=>exam.id));
            for (const id of scoreExams.get(previous.id) || []) included.add(id);
            changed.push({...previous,_ts:Math.max(timestamp,(previous._ts || 0)+1),rosterMembership:{
                version:1,archivedAt:timestamp,includedExamIds:[...included],excludedExamIds:[]
            }});
        }
        return {changed,gradeChanges};
    }

    function examParticipants(directory, grade, classScope) {
        const {groups} = directoryIndex(directory);
        const selected = classScope.map(encoded=>{
            const [campus,teachingClass] = JSON.parse(encoded);
            return groups.get(scopeKey({campus,grade,teachingClass}));
        });
        if (selected.some(info=>!info)) throw Error('有参试班不在当前共享名单中，请刷新后重试。');
        const categories = new Set(selected.map(info=>info.teachingCategory || ''));
        if (categories.has('gaokao') && categories.has('study-abroad')) throw Error('高考日语班和留学班请分别创建考试。');
        if (categories.size !== 1 || categories.has('')) return null;
        const classes = selected.map(({id,campus,grade,teachingClass,teachingCategory})=>
            ({id,campus,grade,teachingClass,teachingCategory}));
        const students = classes.flatMap(({id})=>Object.values(directory.classes[id].students)
            .map(student=>({studentId:student.gakutenId,classId:id})));
        if (students.some(student=>!student.studentId) || new Set(students.map(student=>student.studentId)).size !== students.length) {
            throw Error('参试学生的共享身份有缺失或重复。');
        }
        return {classes,students};
    }

    function applyRenames(directory, data) {
        const events = new Map();
        for (const {info} of Object.values(directory.classes)) {
            for (const event of info.gakutenScopeRenames || []) events.set(event.id,event);
        }
        let changed = false;
        for (const event of [...events.values()].sort((a,b)=>a.at-b.at)) {
            const {field,original,name,campus,grade,id} = event;
            if (!id || !['campus','teachingClass'].includes(field)) continue;
            const isCampus = field === 'campus';
            const rewrite = place => {
                if (place[field] === original && (isCampus || place.campus === campus)) {
                    place[field] = name;
                    return true;
                }
                return false;
            };
            const mark = record => {
                record.gakutenAppliedScopeRenames = [...(record.gakutenAppliedScopeRenames || []),id];
                record._ts = Math.max(Date.now(),(record._ts || 0)+1);
                changed = true;
            };
            for (const student of data.students) {
                if (student.gakutenAppliedScopeRenames?.includes(id) || !isCampus && student.grade !== grade) continue;
                let edited = rewrite(student);
                for (const place of student.classHistory || []) edited = rewrite(place) || edited;
                if (edited) mark(student);
            }
            for (const exam of data.exams) {
                if (exam.gakutenAppliedScopeRenames?.includes(id) || !isCampus && exam.grade !== grade) continue;
                let edited = false;
                if (isCampus) {
                    if (exam.campus === original) { exam.campus = name; edited = true; }
                    if (exam.campuses?.includes(original)) {
                        exam.campuses = [...new Set(exam.campuses.map(site=>site===original ? name : site))];
                        edited = true;
                    }
                }
                if (exam.classScope) {
                    exam.classScope = [...new Set(exam.classScope.map(encoded=>{
                        const [site,teachingClass] = JSON.parse(encoded);
                        const place = {campus:site,teachingClass};
                        if (!rewrite(place)) return encoded;
                        edited = true;
                        return JSON.stringify([place.campus,place.teachingClass]);
                    }))];
                }
                if (edited) mark(exam);
            }
        }
        return changed;
    }

    async function submit(directory, command, request, operationId) {
        const changes = makeChanges(directory,{...command,operationId});
        if (!changes.length) return directory;
        const epochs = Object.fromEntries(changes.map(item=>[item.path[0],directory.epochs[item.path[0]] ?? 0]));
        return request('roster',{syncProtocol:2,userId:directory.user.id,operationId,changes,epochs});
    }

    const sharedRoster = {directoryIndex,makeChanges,project,examParticipants,applyRenames,submit};
    if (typeof module === 'object' && module.exports) module.exports = sharedRoster;
    else window.gk2SharedRoster = sharedRoster;
})();
