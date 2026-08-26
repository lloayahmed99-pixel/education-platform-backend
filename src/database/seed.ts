import bcrypt from 'bcryptjs';
import { query } from './db';

import fs from 'fs';
import path from 'path';

const seedDatabase = async () => {
  console.log('Starting database seed to PostgreSQL...');

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('Executing schema.sql...');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await query(schema);
    }

    await query('BEGIN');

    // 1. Settings
    const settings = [
      { key: 'platform_name', value: 'منصة التعلم' },
      { key: 'primary_color', value: '#f59e0b' }
    ];
    for (const s of settings) {
      await query('INSERT INTO platform_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [s.key, s.value]);
    }

    // 2. Permissions
    const permissions = [
      'view_students', 'manage_students', 'view_courses', 'manage_courses',
      'manage_videos', 'manage_quizzes', 'moderate_forum', 'manage_reports', 'send_notifications'
    ];
    for (const p of permissions) {
      await query('INSERT INTO permissions (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [p]);
    }

    // 3. Admin User
    let adminResult = await query('SELECT id FROM users WHERE email = $1', ['admin@platform.com']);
    let adminId = adminResult.rows[0]?.id;
    
    if (!adminId) {
      const hash = bcrypt.hashSync('Admin@123456', 10);
      const info = await query(
        "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin') RETURNING id",
        ['Admin', 'admin@platform.com', hash]
      );
      adminId = info.rows[0].id;
    }

    // 4. Moderators
    const createMod = async (email: string, name: string, perms: string[]) => {
      let modUserResult = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (modUserResult.rows.length === 0) {
        const hash = bcrypt.hashSync('Mod@123456', 10);
        const userInfo = await query(
          "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'moderator') RETURNING id",
          [name, email, hash]
        );
        const modInfo = await query(
          "INSERT INTO moderators (user_id, created_by) VALUES ($1, $2) RETURNING id",
          [userInfo.rows[0].id, adminId]
        );
        
        for (const p of perms) {
          const permResult = await query('SELECT id FROM permissions WHERE name = $1', [p]);
          if (permResult.rows.length > 0) {
            await query(
              'INSERT INTO moderator_permissions (moderator_id, permission_id) VALUES ($1, $2)',
              [modInfo.rows[0].id, permResult.rows[0].id]
            );
          }
        }
      }
    };
    
    await createMod('mod1@platform.com', 'Moderator One', permissions);
    await createMod('mod2@platform.com', 'Moderator Two', ['view_students', 'view_courses', 'moderate_forum']);

    // 5. Students
    const studentIds: number[] = [];
    for (let i = 1; i <= 10; i++) {
      const email = `student${i}@platform.com`;
      let studentResult = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (studentResult.rows.length === 0) {
        const hash = bcrypt.hashSync('Student@123456', 10);
        const info = await query(
          "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'student') RETURNING id",
          [`Student ${i}`, email, hash]
        );
        studentIds.push(info.rows[0].id);
      } else {
        studentIds.push(studentResult.rows[0].id);
      }
    }

    // 6. Courses
    const coursesData = [
      { title: 'الرياضيات للصف الثالث الثانوي', price: 999 },
      { title: 'اللغة العربية - الصف الأول الثانوي', price: 470 },
      { title: 'الفيزياء - الصف الثاني الثانوي', price: 650 },
      { title: 'الكيمياء للمرحلة الثانوية', price: 550 },
      { title: 'الأحياء - الصف الثالث الثانوي', price: 499 }
    ];

    const courseIds: number[] = [];
    for (const c of coursesData) {
      let courseResult = await query('SELECT id FROM courses WHERE title = $1', [c.title]);
      if (courseResult.rows.length === 0) {
        const info = await query(
          "INSERT INTO courses (title, price, published, instructor_id) VALUES ($1, $2, 1, $3) RETURNING id",
          [c.title, c.price, adminId]
        );
        const courseId = info.rows[0].id;
        courseIds.push(courseId);

        // Modules & Videos
        for (let m = 1; m <= 3; m++) {
          const modInfo = await query("INSERT INTO modules (course_id, title) VALUES ($1, $2) RETURNING id", [courseId, `الوحدة ${m}`]);
          for (let v = 1; v <= 3; v++) {
            await query(
              "INSERT INTO videos (course_id, module_id, title, url, duration_seconds) VALUES ($1, $2, $3, $4, $5)",
              [courseId, modInfo.rows[0].id, `الدرس ${v}`, 'https://www.youtube.com/embed/dQw4w9WgXcQ', 600]
            );
          }
        }
        
        // Quiz
        const quizInfo = await query("INSERT INTO quizzes (course_id, title) VALUES ($1, $2) RETURNING id", [courseId, 'اختبار نهاية الكورس']);
        for (let q = 1; q <= 5; q++) {
          const qInfo = await query("INSERT INTO questions (quiz_id, question_text) VALUES ($1, $2) RETURNING id", [quizInfo.rows[0].id, `السؤال رقم ${q}`]);
          for (let a = 1; a <= 4; a++) {
            await query(
              "INSERT INTO answers (question_id, answer_text, is_correct) VALUES ($1, $2, $3)",
              [qInfo.rows[0].id, `إجابة ${a}`, a === 1 ? 1 : 0]
            );
          }
        }
      } else {
        courseIds.push(courseResult.rows[0].id);
      }
    }

    // 7. Enrollments
    for (let i = 0; i < 5; i++) {
      if (studentIds[i]) {
        await query("INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [studentIds[i], courseIds[0]]);
        await query("INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [studentIds[i], courseIds[1]]);
        await query("INSERT INTO enrollments (student_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [studentIds[i], courseIds[2]]);
      }
    }

    // 8. Forum Posts
    const existingPostResult = await query("SELECT id FROM forum_posts LIMIT 1");
    if (existingPostResult.rows.length === 0 && studentIds[0]) {
      await query("INSERT INTO forum_posts (author_id, title, content) VALUES ($1, $2, $3)", [studentIds[0], 'مرحبا بالجميع', 'هذا أول منشور في المنتدى!']);
      await query("INSERT INTO forum_posts (author_id, title, content) VALUES ($1, $2, $3)", [studentIds[1], 'سؤال في الرياضيات', 'كيف أحل المعادلة التربيعية؟']);
    }

    await query('COMMIT');
    console.log('Database seeded successfully to PostgreSQL.');
    process.exit(0);
  } catch (err) {
    await query('ROLLBACK');
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seedDatabase();
