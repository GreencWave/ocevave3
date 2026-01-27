// Admin account configuration
// 관리자 계정은 하드코딩되어 있으며 데이터베이스에 저장되지 않습니다
export const ADMIN_ACCOUNT = {
  email: 'admin@ocevave',
  password: 'admin123',
  name: 'OCEVAVE Admin'
};

// Check if email is admin email
export function isAdminEmail(email: string): boolean {
  return email.toLowerCase() === ADMIN_ACCOUNT.email.toLowerCase();
}
