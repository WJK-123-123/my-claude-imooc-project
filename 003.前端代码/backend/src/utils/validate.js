// 账号格式校验（规则来源：PRD F1-1 / F1-2，与 004 user 表 CHECK 约束对齐）

// 用户名 2–20 个字符，支持中文、字母、数字、下划线
const USERNAME_RE = /^[一-龥A-Za-z0-9_]+$/;

export function validateUsername(username) {
  if (typeof username !== 'string' || username.length === 0) return '请输入用户名';
  const len = [...username].length; // 按码点计数，与数据库 CHAR_LENGTH 口径一致
  if (len < 2 || len > 20) return '用户名需 2–20 个字符';
  if (!USERNAME_RE.test(username)) return '用户名仅支持中文、字母、数字、下划线';
  return null;
}

// 密码 6–20 位，任意可见字符（不含空白），需包含数字/小写/大写/特殊字符四类中的至少三类（PRD F1-2）
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) return '请输入密码';
  const len = [...password].length;
  if (len < 6 || len > 20) return '密码需 6–20 位';
  if (/\s/.test(password)) return '密码不能包含空格';
  const kinds = [/\d/, /[a-z]/, /[A-Z]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (kinds < 3) return '密码不符合规范，请重新输入';
  return null;
}
