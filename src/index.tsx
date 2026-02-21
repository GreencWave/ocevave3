import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { Bindings, User, Product, Order, Event, Activity } from './types';
import { hashPassword, verifyPassword, generateOrderNumber, isValidEmail, sanitizeHtml } from './utils';
import { ADMIN_ACCOUNT, isAdminEmail } from './admin-config';
import { authMiddleware, requireAuth, requireAdmin } from './middleware';

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS
app.use('/api/*', cors());

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// Auth middleware
app.use('*', authMiddleware);

// ============================================
// API Routes - Authentication
// ============================================

app.post('/api/auth/signup', async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    // Validation
    if (!email || !password || !name) {
      return c.json({ error: '모든 필드를 입력해주세요.' }, 400);
    }
    
    if (!isValidEmail(email)) {
      return c.json({ error: '유효한 이메일 주소를 입력해주세요.' }, 400);
    }
    
    if (password.length < 6) {
      return c.json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' }, 400);
    }
    
    // Check if email is admin email
    if (isAdminEmail(email)) {
      return c.json({ error: '이 이메일은 사용할 수 없습니다.' }, 400);
    }
    
    const { DB } = c.env;
    
    // Check if user already exists
    const existingUser = await DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existingUser) {
      return c.json({ error: '이미 가입된 이메일입니다.' }, 400);
    }
    
    // Hash password
    const { hash, salt } = await hashPassword(password);
    
    // Insert user
    await DB.prepare(`
      INSERT INTO users (email, password_hash, password_salt, name, is_admin)
      VALUES (?, ?, ?, ?, 0)
    `).bind(email, hash, salt, name).run();
    
    return c.json({ success: true, message: '회원가입이 완료되었습니다.' });
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ error: '회원가입 중 오류가 발생했습니다.' }, 500);
  }
});

app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: '이메일과 비밀번호를 입력해주세요.' }, 400);
    }
    
    // Check if admin account
    if (isAdminEmail(email)) {
      if (password === ADMIN_ACCOUNT.password) {
        // Create session token
        const sessionToken = btoa(`${email}:${Date.now()}`);
        setCookie(c, 'session_token', sessionToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
        
        return c.json({
          success: true,
          user: {
            email: ADMIN_ACCOUNT.email,
            name: ADMIN_ACCOUNT.name,
            is_admin: true
          }
        });
      } else {
        return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
      }
    }
    
    const { DB } = c.env;
    
    // Get user from database
    const user = await DB.prepare(`
      SELECT id, email, name, password_hash, password_salt, is_admin
      FROM users WHERE email = ?
    `).bind(email).first() as User | null;
    
    if (!user) {
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    }
    
    // Verify password
    const isValid = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!isValid) {
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    }
    
    // Create session token
    const sessionToken = btoa(`${email}:${Date.now()}`);
    setCookie(c, 'session_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    return c.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        is_admin: user.is_admin === 1
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: '로그인 중 오류가 발생했습니다.' }, 500);
  }
});

app.post('/api/auth/logout', (c) => {
  deleteCookie(c, 'session_token');
  return c.json({ success: true });
});

app.get('/api/auth/me', async (c) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ user: null });
  }
  
  // Check if admin
  if (isAdminEmail(user.email)) {
    return c.json({
      user: {
        email: ADMIN_ACCOUNT.email,
        name: ADMIN_ACCOUNT.name,
        is_admin: true
      }
    });
  }
  
  const { DB } = c.env;
  
  // Get user from database
  const dbUser = await DB.prepare(`
    SELECT id, email, name, is_admin FROM users WHERE email = ?
  `).bind(user.email).first() as User | null;
  
  if (!dbUser) {
    return c.json({ user: null });
  }
  
  return c.json({
    user: {
      email: dbUser.email,
      name: dbUser.name,
      is_admin: dbUser.is_admin === 1
    }
  });
});

// ============================================
// API Routes - Products
// ============================================

app.get('/api/products', async (c) => {
  try {
    const { DB } = c.env;
    const { results } = await DB.prepare('SELECT * FROM products ORDER BY id').all();
    return c.json({ products: results });
  } catch (error) {
    console.error('Get products error:', error);
    return c.json({ error: '상품 목록을 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

app.get('/api/products/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { DB } = c.env;
    const product = await DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    
    if (!product) {
      return c.json({ error: '상품을 찾을 수 없습니다.' }, 404);
    }
    
    return c.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    return c.json({ error: '상품 정보를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

// ============================================
// API Routes - Events
// ============================================

app.get('/api/events', async (c) => {
  try {
    const { DB } = c.env;
    const { results } = await DB.prepare('SELECT * FROM events ORDER BY created_at DESC').all();
    return c.json({ events: results });
  } catch (error) {
    console.error('Get events error:', error);
    return c.json({ error: '이벤트 목록을 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

app.get('/api/events/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { DB } = c.env;
    const event = await DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
    
    if (!event) {
      return c.json({ error: '이벤트를 찾을 수 없습니다.' }, 404);
    }
    
    return c.json({ event });
  } catch (error) {
    console.error('Get event error:', error);
    return c.json({ error: '이벤트 정보를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

// ============================================
// API Routes - Activities
// ============================================

app.get('/api/activities', async (c) => {
  try {
    const { DB } = c.env;
    const { results } = await DB.prepare('SELECT * FROM activities ORDER BY created_at DESC').all();
    return c.json({ activities: results });
  } catch (error) {
    console.error('Get activities error:', error);
    return c.json({ error: '활동 목록을 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

app.get('/api/activities/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { DB } = c.env;
    const activity = await DB.prepare('SELECT * FROM activities WHERE id = ?').bind(id).first();
    
    if (!activity) {
      return c.json({ error: '활동을 찾을 수 없습니다.' }, 404);
    }
    
    return c.json({ activity });
  } catch (error) {
    console.error('Get activity error:', error);
    return c.json({ error: '활동 정보를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

// ============================================
// API Routes - Event Reservations
// ============================================

app.post('/api/events/reserve', async (c) => {
  try {
    const { event_id, name, email, phone, participants } = await c.req.json();
    
    if (!event_id || !name || !email || !phone || !participants) {
      return c.json({ error: '모든 필드를 입력해주세요.' }, 400);
    }
    
    const { DB } = c.env;
    const user = c.get('user');
    
    await DB.prepare(`
      INSERT INTO event_reservations (event_id, user_id, name, email, phone, participants, status)
      VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
    `).bind(event_id, user?.email ? null : null, name, email, phone, participants).run();
    
    return c.json({ success: true, message: '예약이 완료되었습니다.' });
  } catch (error) {
    console.error('Reservation error:', error);
    return c.json({ error: '예약 중 오류가 발생했습니다.' }, 500);
  }
});

// ============================================
// API Routes - Donations
// ============================================

app.post('/api/donations', async (c) => {
  try {
    const { amount, name, email, phone } = await c.req.json();
    
    if (!amount || !name || !email || !phone) {
      return c.json({ error: '모든 필드를 입력해주세요.' }, 400);
    }
    
    if (amount < 10000) {
      return c.json({ error: '최소 후원 금액은 10,000원입니다.' }, 400);
    }
    
    const { DB } = c.env;
    
    await DB.prepare(`
      INSERT INTO donations (amount, donor_name, donor_email, donor_phone, donation_type, status)
      VALUES (?, ?, ?, ?, 'monthly', 'active')
    `).bind(amount, name, email, phone).run();
    
    return c.json({ 
      success: true, 
      message: '정기 후원 신청이 완료되었습니다. 감사합니다!' 
    });
  } catch (error) {
    console.error('Donation error:', error);
    return c.json({ error: '후원 신청 중 오류가 발생했습니다.' }, 500);
  }
});

// ============================================
// API Routes - Orders
// ============================================

app.post('/api/orders', async (c) => {
  try {
    const { items, shipping } = await c.req.json();
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return c.json({ error: '주문 상품이 없습니다.' }, 400);
    }
    
    if (!shipping || !shipping.name || !shipping.phone || !shipping.address) {
      return c.json({ error: '배송 정보를 입력해주세요.' }, 400);
    }
    
    const { DB } = c.env;
    const user = c.get('user');
    
    // Calculate total amount
    let totalAmount = 0;
    for (const item of items) {
      const product = await DB.prepare('SELECT price FROM products WHERE id = ?').bind(item.productId).first() as Product | null;
      if (product) {
        totalAmount += product.price * item.quantity;
      }
    }
    
    // Generate order number
    const orderNumber = generateOrderNumber();
    
    // Insert order
    const orderResult = await DB.prepare(`
      INSERT INTO orders (user_id, order_number, total_amount, status, shipping_name, shipping_phone, shipping_address, shipping_zipcode, payment_method, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user?.email ? null : null,
      orderNumber,
      totalAmount,
      'pending',
      shipping.name,
      shipping.phone,
      shipping.address,
      shipping.zipcode || null,
      'card',
      'pending'
    ).run();
    
    const orderId = orderResult.meta.last_row_id;
    
    // Insert order items
    for (const item of items) {
      const product = await DB.prepare('SELECT name, price FROM products WHERE id = ?').bind(item.productId).first() as Product | null;
      if (product) {
        await DB.prepare(`
          INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
          VALUES (?, ?, ?, ?, ?)
        `).bind(orderId, item.productId, product.name, item.quantity, product.price).run();
      }
    }
    
    return c.json({
      success: true,
      orderNumber,
      orderId,
      totalAmount
    });
  } catch (error) {
    console.error('Create order error:', error);
    return c.json({ error: '주문 생성 중 오류가 발생했습니다.' }, 500);
  }
});

app.get('/api/orders/:orderNumber', async (c) => {
  try {
    const orderNumber = c.req.param('orderNumber');
    const { DB } = c.env;
    
    const order = await DB.prepare(`
      SELECT * FROM orders WHERE order_number = ?
    `).bind(orderNumber).first();
    
    if (!order) {
      return c.json({ error: '주문을 찾을 수 없습니다.' }, 404);
    }
    
    const { results: items } = await DB.prepare(`
      SELECT * FROM order_items WHERE order_id = ?
    `).bind((order as any).id).all();
    
    return c.json({ order, items });
  } catch (error) {
    console.error('Get order error:', error);
    return c.json({ error: '주문 정보를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

// ============================================
// API Routes - Admin
// ============================================

app.get('/api/admin/orders', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const { DB } = c.env;
    
    // Get all orders
    const { results: orders } = await DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    
    // Get order items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order: any) => {
        const { results: items } = await DB.prepare(`
          SELECT oi.*, p.name as product_name, p.image_url
          FROM order_items oi
          LEFT JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `).bind(order.id).all();
        
        return {
          ...order,
          items: items
        };
      })
    );
    
    return c.json({ orders: ordersWithItems });
  } catch (error) {
    console.error('Get orders error:', error);
    return c.json({ error: '주문 목록을 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

app.get('/api/admin/reservations', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const { DB } = c.env;
    const { results } = await DB.prepare(`
      SELECT r.*, e.title as event_title 
      FROM event_reservations r
      JOIN events e ON r.event_id = e.id
      ORDER BY r.created_at DESC
    `).all();
    return c.json({ reservations: results });
  } catch (error) {
    console.error('Get reservations error:', error);
    return c.json({ error: '예약 목록을 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

app.get('/api/admin/members', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const { DB } = c.env;
    const { results } = await DB.prepare(`
      SELECT id, email, name, is_admin, created_at 
      FROM users 
      ORDER BY created_at DESC
    `).all();
    return c.json({ members: results });
  } catch (error) {
    console.error('Get members error:', error);
    return c.json({ error: '회원 목록을 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

app.get('/api/admin/donations', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const { DB } = c.env;
    const { results } = await DB.prepare(`
      SELECT * FROM donations 
      ORDER BY created_at DESC
    `).all();
    return c.json({ donations: results });
  } catch (error) {
    console.error('Get donations error:', error);
    return c.json({ error: '후원 목록을 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

// ============================================
// API Routes - Crisis Articles Management
// ============================================

app.get('/api/crisis-articles', async (c) => {
  try {
    const { DB } = c.env;
    const { results } = await DB.prepare(`
      SELECT * FROM crisis_articles 
      ORDER BY published_date DESC, created_at DESC
    `).all();
    return c.json({ articles: results });
  } catch (error) {
    console.error('Get crisis articles error:', error);
    return c.json({ error: '기사 목록을 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

app.post('/api/admin/crisis-articles', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const { title, content, source, source_url, image_url, category, published_date } = await c.req.json();
    
    if (!title || !content) {
      return c.json({ error: '제목과 내용은 필수입니다.' }, 400);
    }
    
    const { DB } = c.env;
    const result = await DB.prepare(`
      INSERT INTO crisis_articles (title, content, source, source_url, image_url, category, published_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(title, content, source || '', source_url || '', image_url || '', category || 'general', published_date || null).run();
    
    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    console.error('Create crisis article error:', error);
    return c.json({ error: '기사 생성 중 오류가 발생했습니다.' }, 500);
  }
});

app.delete('/api/admin/crisis-articles/:id', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const id = c.req.param('id');
    const { DB } = c.env;
    await DB.prepare('DELETE FROM crisis_articles WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete crisis article error:', error);
    return c.json({ error: '기사 삭제 중 오류가 발생했습니다.' }, 500);
  }
});

// ============================================
// API Routes - Company Info Management
// ============================================

app.get('/api/company-info', async (c) => {
  try {
    const { DB } = c.env;
    const { results } = await DB.prepare('SELECT * FROM company_info ORDER BY section').all();
    return c.json({ info: results });
  } catch (error) {
    console.error('Get company info error:', error);
    return c.json({ error: '회사 정보를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

app.put('/api/admin/company-info/:section', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const section = c.req.param('section');
    const { title, content } = await c.req.json();
    
    if (!content) {
      return c.json({ error: '내용은 필수입니다.' }, 400);
    }
    
    const { DB } = c.env;
    await DB.prepare(`
      UPDATE company_info
      SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE section = ?
    `).bind(title || '', content, section).run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Update company info error:', error);
    return c.json({ error: '회사 정보 수정 중 오류가 발생했습니다.' }, 500);
  }
});

app.post('/api/admin/products', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const { name, description, price, image_url, category, stock } = await c.req.json();
    
    if (!name || !price) {
      return c.json({ error: '상품명과 가격은 필수입니다.' }, 400);
    }
    
    const { DB } = c.env;
    const result = await DB.prepare(`
      INSERT INTO products (name, description, price, image_url, category, stock)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(name, description || '', price, image_url || '', category || 'eco-goods', stock || 0).run();
    
    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    console.error('Create product error:', error);
    return c.json({ error: '상품 생성 중 오류가 발생했습니다.' }, 500);
  }
});

app.put('/api/admin/products/:id', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const id = c.req.param('id');
    const { name, description, price, image_url, category, stock } = await c.req.json();
    
    const { DB } = c.env;
    await DB.prepare(`
      UPDATE products
      SET name = ?, description = ?, price = ?, image_url = ?, category = ?, stock = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name, description, price, image_url, category, stock, id).run();
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Update product error:', error);
    return c.json({ error: '상품 수정 중 오류가 발생했습니다.' }, 500);
  }
});

app.delete('/api/admin/products/:id', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const id = c.req.param('id');
    const { DB } = c.env;
    await DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete product error:', error);
    return c.json({ error: '상품 삭제 중 오류가 발생했습니다.' }, 500);
  }
});

// Image upload endpoint
app.post('/api/admin/upload-image', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const formData = await c.req.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return c.json({ error: '이미지 파일이 없습니다.' }, 400);
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      return c.json({ error: '이미지 파일만 업로드 가능합니다.' }, 400);
    }
    
    // Check file size (max 10MB for DB, unlimited for R2)
    const maxSize = c.env.R2 ? 50 * 1024 * 1024 : 10 * 1024 * 1024; // 50MB for R2, 10MB for DB
    if (file.size > maxSize) {
      const maxSizeMB = Math.floor(maxSize / 1024 / 1024);
      return c.json({ 
        error: `이미지 크기는 ${maxSizeMB}MB 이하여야 합니다. (현재: ${(file.size / 1024 / 1024).toFixed(2)}MB)` 
      }, 400);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${timestamp}-${randomStr}.${ext}`;
    const key = `images/${filename}`;
    
    const { DB, R2 } = c.env;
    
    // Check if DB is available
    if (!DB) {
      console.error('Database not available');
      return c.json({ error: 'D1 데이터베이스가 설정되지 않았습니다. Cloudflare Dashboard에서 DB 바인딩을 설정해주세요.' }, 500);
    }
    
    // Try to upload to R2 (production)
    if (R2) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        await R2.put(key, arrayBuffer, {
          httpMetadata: {
            contentType: file.type,
          },
        });
        
        const imageUrl = `/api/images/${filename}`;
        return c.json({ success: true, url: imageUrl });
      } catch (r2Error) {
        console.log('R2 upload failed, falling back to database storage:', r2Error);
      }
    }
    
    // Store in database as base64
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      
      // Store in database
      await DB.prepare(`
        INSERT INTO images (filename, data, content_type)
        VALUES (?, ?, ?)
      `).bind(filename, base64Data, file.type).run();
      
      const imageUrl = `/api/images/${filename}`;
      return c.json({ success: true, url: imageUrl });
    } catch (dbError) {
      console.error('Database storage error:', dbError);
      return c.json({ error: '이미지 저장 중 오류가 발생했습니다.' }, 500);
    }
    
  } catch (error) {
    console.error('Upload image error:', error);
    return c.json({ error: '이미지 업로드 중 오류가 발생했습니다.' }, 500);
  }
});

// Serve images from R2 or database
app.get('/api/images/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    const key = `images/${filename}`;
    
    const { DB, R2 } = c.env;
    
    // Try R2 first (production with R2)
    if (R2) {
      try {
        const object = await R2.get(key);
        
        if (object) {
          const headers = new Headers();
          headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
          headers.set('Cache-Control', 'public, max-age=31536000');
          
          return new Response(object.body, { headers });
        }
      } catch (r2Error) {
        console.log('R2 get failed, trying database:', r2Error);
      }
    }
    
    // Get from database
    if (!DB) {
      return c.text('Database not configured', 500);
    }
    
    try {
      const image = await DB.prepare('SELECT data, content_type FROM images WHERE filename = ?')
        .bind(filename)
        .first() as { data: string; content_type: string } | null;
      
      if (image) {
        // Decode base64
        const binaryString = atob(image.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const headers = new Headers();
        headers.set('Content-Type', image.content_type);
        headers.set('Cache-Control', 'public, max-age=31536000');
        
        return new Response(bytes.buffer, { headers });
      }
    } catch (dbError) {
      console.error('Database image fetch error:', dbError);
    }
    
    // Image not found
    return c.text('Image not found', 404);
    
  } catch (error) {
    console.error('Get image error:', error);
    return c.text('Error retrieving image', 500);
  }
});


app.post('/api/admin/events', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const { title, content, image_url, event_date, location } = await c.req.json();
    
    if (!title || !content) {
      return c.json({ error: '제목과 내용은 필수입니다.' }, 400);
    }
    
    const { DB } = c.env;
    const result = await DB.prepare(`
      INSERT INTO events (title, content, image_url, event_date, location)
      VALUES (?, ?, ?, ?, ?)
    `).bind(title, content, image_url || null, event_date || null, location || null).run();
    
    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    console.error('Create event error:', error);
    return c.json({ error: '이벤트 생성 중 오류가 발생했습니다.' }, 500);
  }
});

app.delete('/api/admin/events/:id', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const id = c.req.param('id');
    const { DB } = c.env;
    await DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    return c.json({ error: '이벤트 삭제 중 오류가 발생했습니다.' }, 500);
  }
});

app.post('/api/admin/activities', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const { title, content, image_url, activity_date, location } = await c.req.json();
    
    if (!title || !content) {
      return c.json({ error: '제목과 내용은 필수입니다.' }, 400);
    }
    
    const { DB } = c.env;
    const result = await DB.prepare(`
      INSERT INTO activities (title, content, image_url, activity_date, location)
      VALUES (?, ?, ?, ?, ?)
    `).bind(title, content, image_url || null, activity_date || null, location || null).run();
    
    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    console.error('Create activity error:', error);
    return c.json({ error: '활동 생성 중 오류가 발생했습니다.' }, 500);
  }
});

app.delete('/api/admin/activities/:id', async (c) => {
  const authError = requireAdmin(c);
  if (authError) return authError;
  
  try {
    const id = c.req.param('id');
    const { DB } = c.env;
    await DB.prepare('DELETE FROM activities WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete activity error:', error);
    return c.json({ error: '활동 삭제 중 오류가 발생했습니다.' }, 500);
  }
});

// ============================================
// HTML Pages
// ============================================

const baseLayout = (title: string, content: string, customCss = '', customJs = '') => `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - OCEVAVE</title>
  <meta name="description" content="OCEVAVE - 바다의 미래를 다시 씁니다">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    :root {
      --ocean: #1a4d5e;
      --sand: #f4e9d8;
      --leaf: #5a7f5f;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: var(--sand);
      color: #333;
    }
    
    .ocean-gradient {
      background: linear-gradient(135deg, #1a4d5e 0%, #2d7a8f 100%);
    }
    
    .fade-in {
      animation: fadeIn 0.6s ease-in;
    }
    
    .slide-up {
      animation: slideUp 0.6s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(30px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .hover-lift {
      transition: all 0.3s ease;
    }
    
    .hover-lift:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    }
    
    .nav-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      background: white;
      min-width: 200px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      overflow: hidden;
      z-index: 1000;
    }
    
    .nav-item:hover .nav-dropdown {
      display: block;
    }
    
    .cart-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #ef4444;
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
    }
    
    .mobile-menu {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9999;
    }
    
    .mobile-menu.active {
      display: flex;
    }
    
    .mobile-menu-content {
      background: white;
      width: 80%;
      max-width: 300px;
      height: 100%;
      overflow-y: auto;
      padding: 20px;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
    }
    
    .mobile-menu.active .mobile-menu-content {
      transform: translateX(0);
    }
    
    ${customCss}
  </style>
</head>
<body>
  <!-- Header -->
  <header class="bg-white shadow-sm fixed w-full top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <button class="md:hidden mr-4" onclick="toggleMobileMenu()">
            <i class="fas fa-bars text-xl"></i>
          </button>
          <a href="/" class="text-2xl font-bold" style="color: var(--ocean);">OCEVAVE</a>
        </div>
        
        <!-- Desktop Navigation -->
        <nav class="hidden md:flex space-x-8">
          <div class="nav-item relative">
            <a href="/crisis" class="text-gray-700 hover:text-gray-900">해양 위기</a>
            <div class="nav-dropdown">
              <a href="/crisis" class="block px-4 py-2 hover:bg-gray-50">위기 현황</a>
              <a href="/crisis/articles" class="block px-4 py-2 hover:bg-gray-50">위기 기사</a>
            </div>
          </div>
          <div class="nav-item relative">
            <a href="/shop" class="text-gray-700 hover:text-gray-900">구매</a>
            <div class="nav-dropdown">
              <a href="/shop" class="block px-4 py-2 hover:bg-gray-50">친환경 굿즈</a>
              <a href="/shop/revenue" class="block px-4 py-2 hover:bg-gray-50">수익 사용처</a>
              <a href="/shop/donation" class="block px-4 py-2 hover:bg-gray-50">정기 후원</a>
            </div>
          </div>
          <div class="nav-item relative">
            <a href="/activities" class="text-gray-700 hover:text-gray-900">활동</a>
          </div>
          <div class="nav-item relative">
            <a href="/events" class="text-gray-700 hover:text-gray-900">이벤트</a>
          </div>
          <div class="nav-item relative">
            <a href="/about" class="text-gray-700 hover:text-gray-900">회사 소개</a>
          </div>
        </nav>
        
        <div class="flex items-center space-x-4">
          <a href="/shop/cart" class="relative text-gray-700 hover:text-gray-900">
            <i class="fas fa-shopping-cart text-xl"></i>
            <span class="cart-badge" id="cartBadge">0</span>
          </a>
          <div id="userMenu"></div>
        </div>
      </div>
    </div>
  </header>
  
  <!-- Mobile Menu -->
  <div class="mobile-menu" id="mobileMenu" onclick="closeMobileMenu(event)">
    <div class="mobile-menu-content" onclick="event.stopPropagation()">
      <button class="mb-6 text-gray-500" onclick="toggleMobileMenu()">
        <i class="fas fa-times text-2xl"></i>
      </button>
      <nav class="space-y-4">
        <a href="/" class="block text-lg text-gray-700 hover:text-gray-900">홈</a>
        <a href="/crisis" class="block text-lg text-gray-700 hover:text-gray-900">해양 위기</a>
        <a href="/shop" class="block text-lg text-gray-700 hover:text-gray-900">구매</a>
        <a href="/activities" class="block text-lg text-gray-700 hover:text-gray-900">활동</a>
        <a href="/events" class="block text-lg text-gray-700 hover:text-gray-900">이벤트</a>
        <a href="/about" class="block text-lg text-gray-700 hover:text-gray-900">회사 소개</a>
      </nav>
    </div>
  </div>
  
  <main class="pt-16">
    ${content}
  </main>
  
  <!-- Footer -->
  <footer class="ocean-gradient text-white py-12 mt-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 class="text-xl font-bold mb-4">OCEVAVE</h3>
          <p class="text-gray-200">바다의 미래를 다시 씁니다</p>
        </div>
        <div>
          <h4 class="font-semibold mb-4">빠른 링크</h4>
          <ul class="space-y-2">
            <li><a href="/about" class="text-gray-200 hover:text-white">회사 소개</a></li>
            <li><a href="/activities" class="text-gray-200 hover:text-white">활동</a></li>
            <li><a href="/events" class="text-gray-200 hover:text-white">이벤트</a></li>
            <li><a href="/shop" class="text-gray-200 hover:text-white">구매</a></li>
          </ul>
        </div>
        <div>
          <h4 class="font-semibold mb-4">문의</h4>
          <p class="text-gray-200">이메일: contact@ocevave.com</p>
          <p class="text-gray-200">전화: 02-1234-5678</p>
        </div>
      </div>
      <div class="mt-8 pt-8 border-t border-gray-600 text-center text-gray-200">
        <p>&copy; 2024 OCEVAVE. All rights reserved.</p>
      </div>
    </div>
  </footer>
  
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script>
    // Global functions
    function toggleMobileMenu() {
      const menu = document.getElementById('mobileMenu');
      menu.classList.toggle('active');
    }
    
    function closeMobileMenu(event) {
      if (event.target.id === 'mobileMenu') {
        toggleMobileMenu();
      }
    }
    
    // Update cart badge
    function updateCartBadge() {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const total = cart.reduce((sum, item) => sum + item.quantity, 0);
      const badge = document.getElementById('cartBadge');
      if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
      }
    }
    
    // Check auth status
    async function checkAuth() {
      try {
        const response = await axios.get('/api/auth/me');
        const { user } = response.data;
        
        const userMenu = document.getElementById('userMenu');
        if (user) {
          userMenu.innerHTML = \`
            <div class="flex items-center space-x-2">
              <span class="text-sm text-gray-700">\${user.name}</span>
              \${user.is_admin ? '<a href="/admin" class="text-sm text-blue-600 hover:text-blue-800">관리자</a>' : ''}
              <button onclick="logout()" class="text-sm text-gray-700 hover:text-gray-900">로그아웃</button>
            </div>
          \`;
        } else {
          userMenu.innerHTML = '<a href="/auth/login" class="text-gray-700 hover:text-gray-900">로그인</a>';
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
    }
    
    async function logout() {
      try {
        await axios.post('/api/auth/logout');
        window.location.href = '/';
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    
    // Initialize
    updateCartBadge();
    checkAuth();
    
    ${customJs}
  </script>
</body>
</html>
`;

// Home page
app.get('/', (c) => {
  return c.html(baseLayout('홈', `
    <div class="hero-section text-white flex items-center justify-center" style="height: 100vh; background-image: url('/static/images/ocean-hero-bg.jpg'); background-size: cover; background-position: center; background-repeat: no-repeat; position: relative;">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, rgba(26, 77, 94, 0.7) 0%, rgba(17, 94, 89, 0.7) 100%);"></div>
      <div class="text-center fade-in" style="position: relative; z-index: 1;">
        <h1 class="text-5xl md:text-7xl font-bold mb-6">OCEVAVE</h1>
        <p class="text-2xl md:text-3xl mb-12">바다의 미래를 다시 씁니다</p>
        <a href="#intro" class="inline-block">
          <i class="fas fa-chevron-down text-4xl animate-bounce"></i>
        </a>
      </div>
    </div>
    
    <div id="intro" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 slide-up">
      <h2 class="text-4xl font-bold text-center mb-12" style="color: var(--ocean);">우리의 사명</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div class="bg-white p-8 rounded-lg shadow-md hover-lift text-center">
          <i class="fas fa-water text-5xl mb-4" style="color: var(--ocean);"></i>
          <h3 class="text-xl font-semibold mb-4">해양 보호</h3>
          <p class="text-gray-600">깨끗한 바다를 위한 지속 가능한 솔루션을 제공합니다.</p>
        </div>
        <div class="bg-white p-8 rounded-lg shadow-md hover-lift text-center">
          <i class="fas fa-leaf text-5xl mb-4" style="color: var(--leaf);"></i>
          <h3 class="text-xl font-semibold mb-4">책임 있는 소비</h3>
          <p class="text-gray-600">친환경 제품으로 지구를 지키는 실천을 이끕니다.</p>
        </div>
        <div class="bg-white p-8 rounded-lg shadow-md hover-lift text-center">
          <i class="fas fa-globe text-5xl mb-4" style="color: var(--ocean);"></i>
          <h3 class="text-xl font-semibold mb-4">창조세계 보전</h3>
          <p class="text-gray-600">자연과 조화를 이루는 미래를 만들어갑니다.</p>
        </div>
      </div>
    </div>
  `, '', `
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  `));
});

// Crisis page
app.get('/crisis', (c) => {
  return c.html(baseLayout('해양 위기', `
    <div class="ocean-gradient text-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold mb-6 fade-in">해양 위기</h1>
        <p class="text-xl fade-in">우리의 바다가 위험에 처해 있습니다</p>
      </div>
    </div>
    
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div class="bg-white p-8 rounded-lg shadow-lg hover-lift slide-up">
          <i class="fas fa-trash text-5xl mb-4 text-red-600"></i>
          <h3 class="text-2xl font-bold mb-4">해양 오염</h3>
          <p class="text-gray-600 leading-relaxed">
            매년 800만 톤 이상의 플라스틱이 바다로 유입되고 있습니다. 
            이는 해양 생태계를 파괴하고, 수많은 해양 생물의 생명을 위협하고 있습니다.
            우리의 무분별한 소비가 바다를 병들게 하고 있습니다.
          </p>
        </div>
        
        <div class="bg-white p-8 rounded-lg shadow-lg hover-lift slide-up" style="animation-delay: 0.1s;">
          <i class="fas fa-temperature-high text-5xl mb-4 text-orange-600"></i>
          <h3 class="text-2xl font-bold mb-4">기후 변화</h3>
          <p class="text-gray-600 leading-relaxed">
            지구 온난화로 인한 해수면 상승과 해양 산성화가 가속화되고 있습니다.
            산호초 백화 현상이 심각해지고, 해양 생태계의 균형이 무너지고 있습니다.
            지금 행동하지 않으면 돌이킬 수 없습니다.
          </p>
        </div>
        
        <div class="bg-white p-8 rounded-lg shadow-lg hover-lift slide-up" style="animation-delay: 0.2s;">
          <i class="fas fa-fish text-5xl mb-4 text-blue-600"></i>
          <h3 class="text-2xl font-bold mb-4">생태계 파괴</h3>
          <p class="text-gray-600 leading-relaxed">
            남획과 서식지 파괴로 해양 생물 다양성이 급격히 감소하고 있습니다.
            멸종 위기에 처한 해양 생물이 증가하고, 먹이사슬이 붕괴되고 있습니다.
            모든 생명은 서로 연결되어 있습니다.
          </p>
        </div>
        
        <div class="bg-white p-8 rounded-lg shadow-lg hover-lift slide-up" style="animation-delay: 0.3s;">
          <i class="fas fa-hand-holding-heart text-5xl mb-4 text-green-600"></i>
          <h3 class="text-2xl font-bold mb-4">우리의 희망</h3>
          <p class="text-gray-600 leading-relaxed">
            아직 늦지 않았습니다. 작은 실천이 모여 큰 변화를 만들 수 있습니다.
            OCEVAVE와 함께 바다를 지키고, 미래 세대에게 깨끗한 바다를 물려줍시다.
            당신의 선택이 바다의 미래를 바꿉니다.
          </p>
        </div>
      </div>
    </div>
  `));
});

// About page
app.get('/about', (c) => {
  return c.html(baseLayout('회사 소개', `
    <div class="ocean-gradient text-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold mb-6 fade-in">회사 소개</h1>
        <p class="text-xl fade-in">바다의 미래를 다시 쓰는 기업</p>
      </div>
    </div>
    
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="bg-white p-12 rounded-lg shadow-lg slide-up">
        <h2 class="text-3xl font-bold mb-6" style="color: var(--ocean);">우리의 비전</h2>
        <p class="text-lg text-gray-700 leading-relaxed mb-8">
          OCEVAVE는 "바다의 미래를 다시 씁니다"라는 슬로건 아래, 
          해양 환경 보호를 위한 실질적인 행동을 이끄는 기업입니다.
        </p>
        
        <h2 class="text-3xl font-bold mb-6" style="color: var(--ocean);">우리의 가치관</h2>
        <div class="space-y-6">
          <div>
            <h3 class="text-xl font-semibold mb-2" style="color: var(--leaf);">환경 보호</h3>
            <p class="text-gray-700 leading-relaxed">
              우리는 지구가 주신 선물인 바다를 소중히 여기고, 
              다음 세대에게 깨끗한 환경을 물려주기 위해 노력합니다.
            </p>
          </div>
          
          <div>
            <h3 class="text-xl font-semibold mb-2" style="color: var(--leaf);">책임 있는 소비</h3>
            <p class="text-gray-700 leading-relaxed">
              친환경 제품을 통해 지속 가능한 소비 문화를 만들고,
              모든 구매가 바다를 지키는 행동이 되도록 합니다.
            </p>
          </div>
          
          <div>
            <h3 class="text-xl font-semibold mb-2" style="color: var(--leaf);">창조세계 보전</h3>
            <p class="text-gray-700 leading-relaxed">
              자연과 인간이 조화롭게 공존하는 세상을 꿈꾸며,
              모든 생명을 존중하고 보호하는 활동을 펼칩니다.
            </p>
          </div>
        </div>
        
        <div class="mt-12 p-6 bg-gray-50 rounded-lg">
          <p class="text-center text-lg text-gray-700 italic">
            "작은 실천이 모여 큰 변화를 만듭니다.<br>
            함께 바다의 미래를 다시 씁시다."
          </p>
        </div>
      </div>
    </div>
  `));
});

// Crisis articles page
app.get('/crisis/articles', async (c) => {
  return c.html(baseLayout('위기 기사', `
    <div class="ocean-gradient text-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold mb-6 fade-in">해양 위기 기사</h1>
        <p class="text-xl fade-in">최신 해양 환경 관련 뉴스와 기사</p>
      </div>
    </div>
    
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div id="articlesContainer" class="text-center py-20">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">기사를 불러오는 중...</p>
      </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script>
      async function loadArticles() {
        try {
          const response = await axios.get('/api/crisis-articles');
          const articles = response.data.articles || [];
          
          const container = document.getElementById('articlesContainer');
          
          if (articles.length === 0) {
            container.innerHTML = \`
              <div class="text-center py-20">
                <i class="fas fa-newspaper text-6xl text-gray-300 mb-4"></i>
                <p class="text-xl text-gray-600">등록된 기사가 없습니다.</p>
              </div>
            \`;
            return;
          }
          
          container.innerHTML = \`
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              \${articles.map(article => \`
                <div class="bg-white rounded-lg shadow-lg overflow-hidden hover-lift">
                  \${article.image_url ? \`
                    <div class="h-48 overflow-hidden">
                      <img src="\${article.image_url}" alt="\${article.title}" class="w-full h-full object-cover">
                    </div>
                  \` : \`
                    <div class="h-48 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <i class="fas fa-newspaper text-6xl text-white opacity-50"></i>
                    </div>
                  \`}
                  <div class="p-6">
                    <div class="flex items-center mb-3">
                      <span class="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        \${getCategoryName(article.category)}
                      </span>
                      <span class="ml-auto text-xs text-gray-500">\${formatDate(article.published_date)}</span>
                    </div>
                    <h3 class="text-xl font-bold mb-3">\${article.title}</h3>
                    <p class="text-gray-600 text-sm mb-4 line-clamp-3">\${article.content}</p>
                    \${article.source ? \`
                      <p class="text-xs text-gray-500 mb-2">출처: \${article.source}</p>
                    \` : ''}
                    \${article.source_url ? \`
                      <a href="\${article.source_url}" target="_blank" class="inline-flex items-center text-sm text-blue-600 hover:text-blue-800">
                        기사 원문 보기
                        <i class="fas fa-external-link-alt ml-2"></i>
                      </a>
                    \` : ''}
                  </div>
                </div>
              \`).join('')}
            </div>
          \`;
        } catch (error) {
          console.error('Load articles error:', error);
          document.getElementById('articlesContainer').innerHTML = \`
            <div class="text-center py-20">
              <i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
              <p class="text-xl text-gray-600">기사를 불러오는데 실패했습니다.</p>
            </div>
          \`;
        }
      }
      
      function getCategoryName(category) {
        const categories = {
          'general': '일반',
          'pollution': '해양 오염',
          'climate': '기후 변화',
          'ecosystem': '생태계'
        };
        return categories[category] || '일반';
      }
      
      function formatDate(dateStr) {
        if (!dateStr) return '날짜 미정';
        const date = new Date(dateStr);
        return date.toLocaleDateString('ko-KR');
      }
      
      loadArticles();
    </script>
  `));
});

// Revenue usage page
app.get('/shop/revenue', (c) => {
  return c.html(baseLayout('수익 사용처', `
    <div class="ocean-gradient text-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold mb-6 fade-in">수익 사용처</h1>
        <p class="text-xl fade-in">여러분의 구매가 바다를 지키는 데 사용됩니다</p>
      </div>
    </div>
    
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="bg-white p-12 rounded-lg shadow-lg slide-up">
        <h2 class="text-3xl font-bold mb-8 text-center" style="color: var(--ocean);">투명한 수익 사용</h2>
        
        <div class="space-y-8">
          <div class="border-l-4 border-blue-600 pl-6">
            <h3 class="text-2xl font-semibold mb-3" style="color: var(--ocean);">40% - 해양 정화 활동</h3>
            <p class="text-gray-700 leading-relaxed">
              전국 해안가에서 진행되는 정화 활동과 쓰레기 수거 캠페인에 사용됩니다.
              자원봉사자 지원, 장비 구입, 수거한 쓰레기의 적절한 처리 비용으로 활용됩니다.
            </p>
          </div>
          
          <div class="border-l-4 border-green-600 pl-6">
            <h3 class="text-2xl font-semibold mb-3" style="color: var(--leaf);">30% - 해양 생태계 보호</h3>
            <p class="text-gray-700 leading-relaxed">
              산호초 복원, 해양 생물 보호 구역 지정, 멸종위기 생물 보호 활동에 투자됩니다.
              해양 생물학자와 협력하여 과학적인 보호 활동을 펼칩니다.
            </p>
          </div>
          
          <div class="border-l-4 border-yellow-600 pl-6">
            <h3 class="text-2xl font-semibold mb-3" style="color: #d97706;">20% - 교육 프로그램</h3>
            <p class="text-gray-700 leading-relaxed">
              어린이와 청소년을 대상으로 한 환경 교육 프로그램을 운영합니다.
              학교 방문 교육, 체험 활동, 교육 자료 제작에 사용됩니다.
            </p>
          </div>
          
          <div class="border-l-4 border-purple-600 pl-6">
            <h3 class="text-2xl font-semibold mb-3" style="color: #9333ea;">10% - 운영 및 연구</h3>
            <p class="text-gray-700 leading-relaxed">
              OCEVAVE의 지속 가능한 운영과 새로운 환경 보호 기술 연구개발에 투자됩니다.
              더 효과적인 보호 방법을 찾기 위해 노력합니다.
            </p>
          </div>
        </div>
        
        <div class="mt-12 p-6 bg-blue-50 rounded-lg">
          <p class="text-center text-lg font-semibold" style="color: var(--ocean);">
            모든 수익 사용 내역은 분기별로 투명하게 공개됩니다
          </p>
        </div>
      </div>
    </div>
  `));
});

// Regular donation page
app.get('/shop/donation', (c) => {
  return c.html(baseLayout('정기 후원', `
    <div class="ocean-gradient text-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold mb-6 fade-in">정기 후원</h1>
        <p class="text-xl fade-in">매달 작은 후원으로 큰 변화를 만들어주세요</p>
      </div>
    </div>
    
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold mb-4" style="color: var(--ocean);">정기 후원 프로그램</h2>
        <p class="text-lg text-gray-700">지속적인 후원으로 바다를 지키는 든든한 파트너가 되어주세요</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div class="bg-white p-8 rounded-lg shadow-lg hover-lift text-center">
          <i class="fas fa-seedling text-5xl mb-4" style="color: var(--leaf);"></i>
          <h3 class="text-2xl font-bold mb-4">씨앗 후원자</h3>
          <p class="text-4xl font-bold mb-4" style="color: var(--ocean);">월 10,000원</p>
          <ul class="text-left space-y-2 mb-6 text-gray-700">
            <li><i class="fas fa-check text-green-600 mr-2"></i>월간 활동 소식지 발송</li>
            <li><i class="fas fa-check text-green-600 mr-2"></i>후원자 전용 뉴스레터</li>
            <li><i class="fas fa-check text-green-600 mr-2"></i>연간 활동 보고서</li>
          </ul>
          <button onclick="startDonation(10000)" class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            후원하기
          </button>
        </div>
        
        <div class="bg-white p-8 rounded-lg shadow-lg hover-lift text-center border-4 border-blue-600">
          <div class="bg-blue-600 text-white px-4 py-1 rounded-full text-sm inline-block mb-4">인기</div>
          <i class="fas fa-water text-5xl mb-4" style="color: var(--ocean);"></i>
          <h3 class="text-2xl font-bold mb-4">파도 후원자</h3>
          <p class="text-4xl font-bold mb-4" style="color: var(--ocean);">월 30,000원</p>
          <ul class="text-left space-y-2 mb-6 text-gray-700">
            <li><i class="fas fa-check text-green-600 mr-2"></i>씨앗 후원자 혜택 전체</li>
            <li><i class="fas fa-check text-green-600 mr-2"></i>정화 활동 초대권 (연 2회)</li>
            <li><i class="fas fa-check text-green-600 mr-2"></i>친환경 굿즈 10% 할인</li>
            <li><i class="fas fa-check text-green-600 mr-2"></i>후원자 감사 이벤트 초대</li>
          </ul>
          <button onclick="startDonation(30000)" class="w-full px-6 py-3 ocean-gradient text-white rounded-lg hover:opacity-90">
            후원하기
          </button>
        </div>
        
        <div class="bg-white p-8 rounded-lg shadow-lg hover-lift text-center">
          <i class="fas fa-ship text-5xl mb-4" style="color: var(--ocean);"></i>
          <h3 class="text-2xl font-bold mb-4">항해 후원자</h3>
          <p class="text-4xl font-bold mb-4" style="color: var(--ocean);">월 50,000원 이상</p>
          <ul class="text-left space-y-2 mb-6 text-gray-700">
            <li><i class="fas fa-check text-green-600 mr-2"></i>파도 후원자 혜택 전체</li>
            <li><i class="fas fa-check text-green-600 mr-2"></i>VIP 정화 활동 참여 (무제한)</li>
            <li><i class="fas fa-check text-green-600 mr-2"></i>친환경 굿즈 20% 할인</li>
            <li><i class="fas fa-check text-green-600 mr-2"></i>연간 감사패 증정</li>
            <li><i class="fas fa-check text-green-600 mr-2"></i>홈페이지 후원자 명단 등재</li>
          </ul>
          <button onclick="startDonation(50000)" class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            후원하기
          </button>
        </div>
      </div>
      
      <div class="bg-white p-8 rounded-lg shadow-lg">
        <h3 class="text-2xl font-bold mb-6 text-center" style="color: var(--ocean);">정기 후원 신청</h3>
        <form id="donationForm" class="max-w-2xl mx-auto space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">후원 금액 선택</label>
            <select id="donation_amount" class="w-full px-4 py-2 border rounded-lg">
              <option value="10000">월 10,000원 (씨앗 후원자)</option>
              <option value="30000" selected>월 30,000원 (파도 후원자)</option>
              <option value="50000">월 50,000원 (항해 후원자)</option>
              <option value="100000">월 100,000원 (항해 후원자 프리미엄)</option>
              <option value="custom">직접 입력</option>
            </select>
          </div>
          <div id="customAmountDiv" class="hidden">
            <label class="block text-sm font-medium mb-2">후원 금액 (원)</label>
            <input type="number" id="custom_amount" min="10000" class="w-full px-4 py-2 border rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">이름 *</label>
            <input type="text" id="donor_name" required class="w-full px-4 py-2 border rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">이메일 *</label>
            <input type="email" id="donor_email" required class="w-full px-4 py-2 border rounded-lg">
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">전화번호 *</label>
            <input type="tel" id="donor_phone" required class="w-full px-4 py-2 border rounded-lg">
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <p class="text-sm text-gray-600 mb-2">
              <i class="fas fa-info-circle mr-2"></i>
              정기 후원은 매월 1일에 자동으로 결제됩니다.
            </p>
            <p class="text-sm text-gray-600">
              <i class="fas fa-shield-alt mr-2"></i>
              후원 내역은 연말정산 시 기부금 공제를 받을 수 있습니다.
            </p>
          </div>
          <button type="submit" class="w-full px-6 py-3 ocean-gradient text-white rounded-lg hover:opacity-90 text-lg font-semibold">
            정기 후원 신청하기
          </button>
        </form>
      </div>
      
      <div class="mt-12 bg-green-50 border border-green-200 rounded-lg p-8">
        <h3 class="text-2xl font-bold mb-4 text-center" style="color: var(--leaf);">후원금 사용 내역</h3>
        <p class="text-center text-gray-700 leading-relaxed">
          후원해 주신 소중한 마음은 100% 해양 보호 활동에만 사용됩니다.<br>
          모든 후원금 사용 내역은 매월 투명하게 공개되며,<br>
          후원자님께 정기적으로 활동 보고서를 보내드립니다.
        </p>
      </div>
    </div>
  `, '', `
    document.getElementById('donation_amount').addEventListener('change', function() {
      const customDiv = document.getElementById('customAmountDiv');
      if (this.value === 'custom') {
        customDiv.classList.remove('hidden');
      } else {
        customDiv.classList.add('hidden');
      }
    });
    
    function startDonation(amount) {
      document.getElementById('donation_amount').value = amount;
      window.scrollTo({ top: document.getElementById('donationForm').offsetTop - 100, behavior: 'smooth' });
    }
    
    document.getElementById('donationForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      let amount = document.getElementById('donation_amount').value;
      if (amount === 'custom') {
        amount = document.getElementById('custom_amount').value;
        if (!amount || parseInt(amount) < 10000) {
          alert('최소 후원 금액은 10,000원입니다.');
          return;
        }
      }
      
      const data = {
        amount: parseInt(amount),
        name: document.getElementById('donor_name').value,
        email: document.getElementById('donor_email').value,
        phone: document.getElementById('donor_phone').value
      };
      
      try {
        const response = await axios.post('/api/donations', data);
        alert('정기 후원 신청이 완료되었습니다!\\n\\n후원 금액: ' + parseInt(amount).toLocaleString() + '원/월\\n\\n감사합니다! 매월 첫째 날 자동으로 결제되며,\\n활동 소식지를 보내드리겠습니다.');
        document.getElementById('donationForm').reset();
      } catch (error) {
        console.error('Donation error:', error);
        alert(error.response?.data?.error || '후원 신청 중 오류가 발생했습니다.');
      }
    });
  `));
});

// ============================================
// Shop Pages
// ============================================

app.get('/shop', async (c) => {
  return c.html(baseLayout('구매', `
    <div class="ocean-gradient text-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold mb-6 fade-in">친환경 굿즈</h1>
        <p class="text-xl fade-in">구매로 바다를 지키는 실천에 동참하세요</p>
      </div>
    </div>
    
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div id="productsContainer" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div class="text-center py-20 col-span-full">
          <i class="fas fa-spinner fa-spin text-4xl text-gray-400"></i>
          <p class="mt-4 text-gray-600">상품을 불러오는 중...</p>
        </div>
      </div>
    </div>
  `, '', `
    async function loadProducts() {
      try {
        const response = await axios.get('/api/products');
        const { products } = response.data;
        const container = document.getElementById('productsContainer');
        
        if (products.length === 0) {
          container.innerHTML = '<div class="col-span-full text-center py-20"><p class="text-gray-600">상품이 없습니다.</p></div>';
          return;
        }
        
        container.innerHTML = products.map(product => \`
          <div class="bg-white rounded-lg shadow-lg overflow-hidden hover-lift">
            <div class="h-64 bg-gray-200 flex items-center justify-center overflow-hidden">
              \${product.image_url ? 
                \`<img src="\${product.image_url}" alt="\${product.name}" class="w-full h-full object-cover">\` : 
                \`<i class="fas fa-shopping-bag text-6xl text-gray-400"></i>\`
              }
            </div>
            <div class="p-6">
              <h3 class="text-xl font-semibold mb-2">\${product.name}</h3>
              <p class="text-gray-600 mb-4 line-clamp-2">\${product.description}</p>
              <div class="flex justify-between items-center">
                <span class="text-2xl font-bold" style="color: var(--ocean);">\${product.price.toLocaleString()}원</span>
                <button onclick="addToCart(\${product.id})" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  담기
                </button>
              </div>
              <a href="/shop/product/\${product.id}" class="block mt-4 text-center text-blue-600 hover:text-blue-800">
                상세보기
              </a>
            </div>
          </div>
        \`).join('');
      } catch (error) {
        console.error('Load products error:', error);
        document.getElementById('productsContainer').innerHTML = '<div class="col-span-full text-center py-20"><p class="text-red-600">상품을 불러오는데 실패했습니다.</p></div>';
      }
    }
    
    function addToCart(productId) {
      axios.get('/api/products/' + productId).then(response => {
        const product = response.data.product;
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const existingItem = cart.find(item => item.productId === productId);
        
        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          cart.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            image_url: product.image_url
          });
        }
        
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
        alert('장바구니에 추가되었습니다.');
      }).catch(error => {
        console.error('Add to cart error:', error);
        alert('장바구니에 추가하는데 실패했습니다.');
      });
    }
    
    loadProducts();
  `));
});

// Product detail page
app.get('/shop/product/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { DB } = c.env;
    
    const product = await DB.prepare('SELECT * FROM products WHERE id = ?')
      .bind(id)
      .first() as Product | null;
    
    if (!product) {
      return c.html(baseLayout('상품을 찾을 수 없습니다', `
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 class="text-4xl font-bold mb-4 text-gray-800">상품을 찾을 수 없습니다</h1>
          <p class="text-gray-600 mb-8">요청하신 상품이 존재하지 않습니다.</p>
          <a href="/shop" class="px-6 py-3 ocean-gradient text-white rounded-lg hover:opacity-90">상품 목록으로</a>
        </div>
      `));
    }
    
    return c.html(baseLayout(product.name, `
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            <div class="flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden" style="min-height: 400px;">
              ${product.image_url ? 
                `<img src="${product.image_url}" alt="${product.name}" class="w-full h-full object-cover">` : 
                `<i class="fas fa-shopping-bag text-9xl text-gray-300"></i>`
              }
            </div>
            <div class="flex flex-col justify-between">
              <div>
                <h1 class="text-4xl font-bold mb-4" style="color: var(--ocean);">${product.name}</h1>
                <p class="text-gray-700 text-lg mb-6 leading-relaxed">${product.description}</p>
                <div class="mb-6">
                  <span class="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    ${product.category}
                  </span>
                </div>
                <div class="flex items-baseline gap-4 mb-8">
                  <span class="text-4xl font-bold" style="color: var(--ocean);">${product.price.toLocaleString()}원</span>
                  ${product.stock > 0 ? 
                    `<span class="text-green-600">재고: ${product.stock}개</span>` : 
                    `<span class="text-red-600">품절</span>`
                  }
                </div>
              </div>
              <div class="space-y-4">
                <div class="flex gap-4">
                  <input type="number" id="quantity" min="1" max="${product.stock}" value="1" 
                    class="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <button onclick="addToCart(${product.id})" 
                    ${product.stock === 0 ? 'disabled' : ''}
                    class="flex-1 px-6 py-3 ocean-gradient text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-semibold">
                    <i class="fas fa-shopping-cart mr-2"></i>장바구니에 담기
                  </button>
                </div>
                <a href="/shop" class="block text-center px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
                  목록으로 돌아가기
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `, '', `
      function addToCart(productId) {
        const quantity = parseInt(document.getElementById('quantity').value);
        
        axios.get('/api/products/' + productId).then(response => {
          const product = response.data.product;
          let cart = JSON.parse(localStorage.getItem('cart') || '[]');
          const existingItem = cart.find(item => item.productId === productId);
          
          if (existingItem) {
            existingItem.quantity += quantity;
          } else {
            cart.push({
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: quantity,
              image_url: product.image_url
            });
          }
          
          localStorage.setItem('cart', JSON.stringify(cart));
          updateCartBadge();
          alert('장바구니에 추가되었습니다.');
        }).catch(error => {
          console.error('Add to cart error:', error);
          alert('장바구니에 추가하는데 실패했습니다.');
        });
      }
    `));
  } catch (error) {
    console.error('Product detail error:', error);
    return c.html(baseLayout('오류', `
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 class="text-4xl font-bold mb-4 text-red-600">오류가 발생했습니다</h1>
        <p class="text-gray-600 mb-8">상품 정보를 불러오는데 실패했습니다.</p>
        <a href="/shop" class="px-6 py-3 ocean-gradient text-white rounded-lg hover:opacity-90">상품 목록으로</a>
      </div>
    `));
  }
});

app.get('/shop/cart', (c) => {
  return c.html(baseLayout('장바구니', `
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <h1 class="text-4xl font-bold mb-8" style="color: var(--ocean);">장바구니</h1>
      <div id="cartContainer"></div>
      <div id="cartSummary" class="mt-8 bg-white p-6 rounded-lg shadow-lg hidden">
        <div class="flex justify-between items-center text-2xl font-bold mb-6">
          <span>총 금액:</span>
          <span id="totalAmount" style="color: var(--ocean);">0원</span>
        </div>
        <button onclick="goToCheckout()" class="w-full px-6 py-3 ocean-gradient text-white rounded-lg hover:opacity-90 text-lg font-semibold">
          주문하기
        </button>
      </div>
    </div>
  `, '', `
    function loadCart() {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const container = document.getElementById('cartContainer');
      const summary = document.getElementById('cartSummary');
      
      if (cart.length === 0) {
        container.innerHTML = \`
          <div class="text-center py-20">
            <i class="fas fa-shopping-cart text-6xl text-gray-400 mb-4"></i>
            <p class="text-xl text-gray-600 mb-6">장바구니가 비어 있습니다</p>
            <a href="/shop" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block">쇼핑 계속하기</a>
          </div>
        \`;
        summary.classList.add('hidden');
        return;
      }
      
      let total = 0;
      container.innerHTML = cart.map((item, index) => {
        total += item.price * item.quantity;
        return \`
          <div class="bg-white p-6 rounded-lg shadow-md mb-4 flex items-center justify-between">
            <div class="flex-1">
              <h3 class="text-xl font-semibold mb-2">\${item.name}</h3>
              <p class="text-gray-600">\${item.price.toLocaleString()}원</p>
            </div>
            <div class="flex items-center space-x-4">
              <button onclick="updateQuantity(\${index}, -1)" class="px-3 py-1 bg-gray-200 rounded">-</button>
              <span class="w-12 text-center">\${item.quantity}</span>
              <button onclick="updateQuantity(\${index}, 1)" class="px-3 py-1 bg-gray-200 rounded">+</button>
              <span class="w-32 text-right font-semibold">\${(item.price * item.quantity).toLocaleString()}원</span>
              <button onclick="removeFromCart(\${index})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        \`;
      }).join('');
      
      document.getElementById('totalAmount').textContent = total.toLocaleString() + '원';
      summary.classList.remove('hidden');
    }
    
    function updateQuantity(index, change) {
      let cart = JSON.parse(localStorage.getItem('cart') || '[]');
      cart[index].quantity += change;
      if (cart[index].quantity <= 0) cart.splice(index, 1);
      localStorage.setItem('cart', JSON.stringify(cart));
      updateCartBadge();
      loadCart();
    }
    
    function removeFromCart(index) {
      if (confirm('이 상품을 장바구니에서 삭제하시겠습니까?')) {
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        cart.splice(index, 1);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartBadge();
        loadCart();
      }
    }
    
    function goToCheckout() {
      window.location.href = '/shop/checkout';
    }
    
    loadCart();
  `));
});

app.get('/shop/checkout', (c) => {
  return c.html(baseLayout('주문하기', `
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <h1 class="text-4xl font-bold mb-8" style="color: var(--ocean);">주문하기</h1>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 class="text-2xl font-semibold mb-6">배송 정보</h2>
          <form id="checkoutForm" class="space-y-4">
            <div><label class="block text-sm font-medium mb-2">이름</label><input type="text" id="shipping_name" required class="w-full px-4 py-2 border rounded-lg"></div>
            <div><label class="block text-sm font-medium mb-2">전화번호</label><input type="tel" id="shipping_phone" required class="w-full px-4 py-2 border rounded-lg"></div>
            <div><label class="block text-sm font-medium mb-2">주소</label><input type="text" id="shipping_address" required class="w-full px-4 py-2 border rounded-lg"></div>
            <div><label class="block text-sm font-medium mb-2">우편번호</label><input type="text" id="shipping_zipcode" class="w-full px-4 py-2 border rounded-lg"></div>
          </form>
        </div>
        <div>
          <h2 class="text-2xl font-semibold mb-6">주문 내역</h2>
          <div id="orderSummary" class="bg-white p-6 rounded-lg shadow-md"></div>
          <button onclick="submitOrder()" class="w-full mt-6 px-6 py-3 ocean-gradient text-white rounded-lg hover:opacity-90 text-lg font-semibold">결제하기</button>
        </div>
      </div>
    </div>
  `, '', `
    function loadOrderSummary() {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      if (cart.length === 0) { window.location.href = '/shop/cart'; return; }
      
      let total = 0;
      const itemsHtml = cart.map(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        return \`<div class="flex justify-between mb-2"><span>\${item.name} x \${item.quantity}</span><span>\${subtotal.toLocaleString()}원</span></div>\`;
      }).join('');
      
      document.getElementById('orderSummary').innerHTML = \`
        <div class="space-y-2 mb-4">\${itemsHtml}</div>
        <div class="border-t pt-4"><div class="flex justify-between text-xl font-bold"><span>총 금액:</span><span style="color: var(--ocean);">\${total.toLocaleString()}원</span></div></div>
      \`;
    }
    
    async function submitOrder() {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      if (cart.length === 0) { alert('장바구니가 비어 있습니다.'); return; }
      
      const shipping = {
        name: document.getElementById('shipping_name').value,
        phone: document.getElementById('shipping_phone').value,
        address: document.getElementById('shipping_address').value,
        zipcode: document.getElementById('shipping_zipcode').value
      };
      
      if (!shipping.name || !shipping.phone || !shipping.address) {
        alert('배송 정보를 모두 입력해주세요.'); return;
      }
      
      try {
        const items = cart.map(item => ({ productId: item.productId, quantity: item.quantity }));
        const response = await axios.post('/api/orders', { items, shipping });
        localStorage.setItem('cart', '[]');
        updateCartBadge();
        window.location.href = '/shop/complete/' + response.data.orderNumber;
      } catch (error) {
        console.error('Order error:', error);
        alert('주문 처리 중 오류가 발생했습니다.');
      }
    }
    
    loadOrderSummary();
  `));
});

app.get('/shop/complete/:orderNumber', async (c) => {
  const orderNumber = c.req.param('orderNumber');
  try {
    const { DB } = c.env;
    const order = await DB.prepare('SELECT * FROM orders WHERE order_number = ?').bind(orderNumber).first();
    if (!order) return c.html(baseLayout('주문 없음', '<div class="text-center py-20"><h1 class="text-3xl mb-4">주문을 찾을 수 없습니다</h1></div>'));
    
    const o = order as any;
    return c.html(baseLayout('주문 완료', `
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <i class="fas fa-check-circle text-8xl text-green-600 mb-6"></i>
        <h1 class="text-4xl font-bold mb-4" style="color: var(--ocean);">주문이 완료되었습니다!</h1>
        <p class="text-xl mb-8">주문번호: <strong>${o.order_number}</strong></p>
        <div class="bg-white p-8 rounded-lg shadow-lg mb-8 text-left">
          <h2 class="text-2xl font-semibold mb-4">배송 정보</h2>
          <p><strong>이름:</strong> ${o.shipping_name}</p>
          <p><strong>전화번호:</strong> ${o.shipping_phone}</p>
          <p><strong>주소:</strong> ${o.shipping_address}</p>
          <div class="mt-6 pt-6 border-t flex justify-between text-2xl font-bold">
            <span>총 결제 금액:</span>
            <span style="color: var(--ocean);">${o.total_amount.toLocaleString()}원</span>
          </div>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
          <p class="text-lg text-green-800"><i class="fas fa-leaf mr-2"></i>고객님의 구매가 바다를 지키는 데 도움이 됩니다.</p>
        </div>
        <div class="space-x-4">
          <a href="/shop" class="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg">쇼핑 계속하기</a>
          <a href="/" class="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg">홈으로</a>
        </div>
      </div>
    `));
  } catch (error) {
    return c.html(baseLayout('오류', '<div class="text-center py-20"><h1 class="text-3xl">오류가 발생했습니다</h1></div>'));
  }
});

// ============================================
// Events Pages
// ============================================

app.get('/events', async (c) => {
  return c.html(baseLayout('이벤트', `
    <div class="ocean-gradient text-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold mb-6 fade-in">이벤트</h1>
        <p class="text-xl fade-in">OCEVAVE의 다양한 이벤트에 참여하세요</p>
      </div>
    </div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div id="eventsContainer" class="grid grid-cols-1 md:grid-cols-2 gap-8"></div>
    </div>
  `, '', `
    async function loadEvents() {
      try {
        const response = await axios.get('/api/events');
        const { events } = response.data;
        const container = document.getElementById('eventsContainer');
        
        if (events.length === 0) {
          container.innerHTML = '<div class="col-span-full text-center py-20"><p class="text-gray-600">이벤트가 없습니다.</p></div>';
          return;
        }
        
        container.innerHTML = events.map(event => \`
          <div class="bg-white rounded-lg shadow-lg overflow-hidden hover-lift">
            <div class="h-48 bg-gray-200 flex items-center justify-center overflow-hidden">
              \${event.image_url ? 
                \`<img src="\${event.image_url}" alt="\${event.title}" class="w-full h-full object-cover">\` : 
                \`<i class="fas fa-calendar text-6xl text-gray-400"></i>\`
              }
            </div>
            <div class="p-6">
              <h3 class="text-2xl font-semibold mb-2">\${event.title}</h3>
              <p class="text-gray-600 mb-4">\${event.content.substring(0, 100)}...</p>
              <div class="flex justify-between items-center text-sm text-gray-500">
                <span><i class="fas fa-calendar-day mr-1"></i>\${event.event_date || '일정 미정'}</span>
                <span><i class="fas fa-map-marker-alt mr-1"></i>\${event.location || '장소 미정'}</span>
              </div>
              <a href="/events/\${event.id}" class="block mt-4 text-center text-blue-600 hover:text-blue-800">
                상세보기
              </a>
            </div>
          </div>
        \`).join('');
      } catch (error) {
        console.error('Load events error:', error);
      }
    }
    loadEvents();
  `));
});

// Event detail page
app.get('/events/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const { DB } = c.env;
    const event = await DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
    
    if (!event) {
      return c.html(baseLayout('이벤트 없음', '<div class="text-center py-20"><h1 class="text-3xl mb-4">이벤트를 찾을 수 없습니다</h1><a href="/events" class="text-blue-600">목록으로</a></div>'));
    }
    
    const e = event as any;
    
    return c.html(baseLayout(e.title, `
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          \${e.image_url ? \`
            <div class="h-96 overflow-hidden">
              <img src="\${e.image_url}" alt="\${e.title}" class="w-full h-full object-cover">
            </div>
          \` : ''}
          <div class="p-8">
            <h1 class="text-4xl font-bold mb-4" style="color: var(--ocean);">\${e.title}</h1>
            <div class="flex items-center space-x-6 text-gray-600 mb-6">
              <span><i class="fas fa-calendar-day mr-2"></i>\${e.event_date || '일정 미정'}</span>
              <span><i class="fas fa-map-marker-alt mr-2"></i>\${e.location || '장소 미정'}</span>
            </div>
            <div class="prose max-w-none mb-8">
              <p class="text-lg leading-relaxed">\${e.content}</p>
            </div>
            <div class="border-t pt-6">
              <button onclick="showReservationForm()" class="px-8 py-3 ocean-gradient text-white rounded-lg hover:opacity-90 text-lg font-semibold">
                <i class="fas fa-calendar-check mr-2"></i>예약하기
              </button>
              <a href="/events" class="ml-4 px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 inline-block">
                목록으로
              </a>
            </div>
          </div>
        </div>
        
        <!-- Reservation Form Modal -->
        <div id="reservationModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 class="text-2xl font-bold mb-6" style="color: var(--ocean);">이벤트 예약</h2>
            <form id="reservationForm" class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-2">이름 *</label>
                <input type="text" id="res_name" required class="w-full px-4 py-2 border rounded-lg">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">이메일 *</label>
                <input type="email" id="res_email" required class="w-full px-4 py-2 border rounded-lg">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">전화번호 *</label>
                <input type="tel" id="res_phone" required class="w-full px-4 py-2 border rounded-lg">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">참가 인원 *</label>
                <input type="number" id="res_participants" required min="1" value="1" class="w-full px-4 py-2 border rounded-lg">
              </div>
              <div class="flex space-x-4">
                <button type="submit" class="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">예약 완료</button>
                <button type="button" onclick="closeReservationForm()" class="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700">취소</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `, '', `
      const eventId = ${e.id};
      
      function showReservationForm() {
        document.getElementById('reservationModal').classList.remove('hidden');
      }
      
      function closeReservationForm() {
        document.getElementById('reservationModal').classList.add('hidden');
      }
      
      document.getElementById('reservationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
          event_id: eventId,
          name: document.getElementById('res_name').value,
          email: document.getElementById('res_email').value,
          phone: document.getElementById('res_phone').value,
          participants: parseInt(document.getElementById('res_participants').value)
        };
        
        try {
          await axios.post('/api/events/reserve', data);
          alert('예약이 완료되었습니다!');
          closeReservationForm();
          document.getElementById('reservationForm').reset();
        } catch (error) {
          console.error('Reservation error:', error);
          alert('예약 중 오류가 발생했습니다.');
        }
      });
      
      // Close modal on background click
      document.getElementById('reservationModal').addEventListener('click', (e) => {
        if (e.target.id === 'reservationModal') {
          closeReservationForm();
        }
      });
    `));
  } catch (error) {
    console.error('Event detail error:', error);
    return c.html(baseLayout('오류', '<div class="text-center py-20"><h1 class="text-3xl">오류가 발생했습니다</h1></div>'));
  }
});

// ============================================
// Activities Pages
// ============================================

app.get('/activities', async (c) => {
  return c.html(baseLayout('활동', `
    <div class="ocean-gradient text-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold mb-6 fade-in">활동</h1>
        <p class="text-xl fade-in">OCEVAVE의 해양 보호 활동을 확인하세요</p>
      </div>
    </div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div id="activitiesContainer" class="grid grid-cols-1 md:grid-cols-2 gap-8"></div>
    </div>
  `, '', `
    async function loadActivities() {
      try {
        const response = await axios.get('/api/activities');
        const { activities } = response.data;
        const container = document.getElementById('activitiesContainer');
        
        if (activities.length === 0) {
          container.innerHTML = '<div class="col-span-full text-center py-20"><p class="text-gray-600">활동이 없습니다.</p></div>';
          return;
        }
        
        container.innerHTML = activities.map(activity => \`
          <div class="bg-white rounded-lg shadow-lg overflow-hidden hover-lift">
            <div class="h-48 bg-gray-200 flex items-center justify-center overflow-hidden">
              \${activity.image_url ? 
                \`<img src="\${activity.image_url}" alt="\${activity.title}" class="w-full h-full object-cover">\` : 
                \`<i class="fas fa-hands-helping text-6xl text-gray-400"></i>\`
              }
            </div>
            <div class="p-6">
              <h3 class="text-2xl font-semibold mb-2">\${activity.title}</h3>
              <p class="text-gray-600 mb-4">\${activity.content.substring(0, 100)}...</p>
              <div class="flex justify-between items-center text-sm text-gray-500">
                <span><i class="fas fa-calendar-day mr-1"></i>\${activity.activity_date || '날짜 미정'}</span>
                <span><i class="fas fa-map-marker-alt mr-1"></i>\${activity.location || '장소 미정'}</span>
              </div>
              <a href="/activities/\${activity.id}" class="block mt-4 text-center text-blue-600 hover:text-blue-800">
                상세보기
              </a>
            </div>
          </div>
        \`).join('');
      } catch (error) {
        console.error('Load activities error:', error);
      }
    }
    loadActivities();
  `));
});

// Activity detail page
app.get('/activities/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const { DB } = c.env;
    const activity = await DB.prepare('SELECT * FROM activities WHERE id = ?').bind(id).first();
    
    if (!activity) {
      return c.html(baseLayout('활동 없음', '<div class="text-center py-20"><h1 class="text-3xl mb-4">활동을 찾을 수 없습니다</h1><a href="/activities" class="text-blue-600">목록으로</a></div>'));
    }
    
    const a = activity as any;
    
    return c.html(baseLayout(a.title, `
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div class="bg-white rounded-lg shadow-lg overflow-hidden">
          ${a.image_url ? `
            <div class="h-96 overflow-hidden">
              <img src="${a.image_url}" alt="${a.title}" class="w-full h-full object-cover">
            </div>
          ` : ''}
          <div class="p-8">
            <h1 class="text-4xl font-bold mb-4" style="color: var(--ocean);">${a.title}</h1>
            <div class="flex items-center space-x-6 text-gray-600 mb-6">
              <span><i class="fas fa-calendar-day mr-2"></i>${a.activity_date || '날짜 미정'}</span>
              <span><i class="fas fa-map-marker-alt mr-2"></i>${a.location || '장소 미정'}</span>
            </div>
            <div class="prose max-w-none mb-8">
              <p class="text-lg leading-relaxed">${a.content}</p>
            </div>
            <div class="border-t pt-6">
              <a href="/activities" class="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 inline-block">
                목록으로
              </a>
            </div>
          </div>
        </div>
      </div>
    `));
  } catch (error) {
    console.error('Activity detail error:', error);
    return c.html(baseLayout('오류', '<div class="text-center py-20"><h1 class="text-3xl">오류가 발생했습니다</h1></div>'));
  }
});

// ============================================
// Auth Pages
// ============================================

app.get('/auth/login', (c) => {
  return c.html(baseLayout('로그인', `
    <div class="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="bg-white p-8 rounded-lg shadow-lg">
        <h1 class="text-3xl font-bold mb-6 text-center" style="color: var(--ocean);">로그인</h1>
        <form id="loginForm" class="space-y-4">
          <div><label class="block text-sm font-medium mb-2">이메일</label><input type="email" id="email" required class="w-full px-4 py-2 border rounded-lg"></div>
          <div><label class="block text-sm font-medium mb-2">비밀번호</label><input type="password" id="password" required class="w-full px-4 py-2 border rounded-lg"></div>
          <button type="submit" class="w-full px-6 py-3 ocean-gradient text-white rounded-lg hover:opacity-90 font-semibold">로그인</button>
        </form>
        <p class="mt-4 text-center text-sm"><a href="/auth/signup" class="text-blue-600 hover:text-blue-800">회원가입</a></p>
      </div>
    </div>
  `, '', `
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await axios.post('/api/auth/login', { email, password });
        alert('로그인 성공!');
        window.location.href = '/';
      } catch (error) {
        alert(error.response?.data?.error || '로그인에 실패했습니다.');
      }
    });
  `));
});

app.get('/auth/signup', (c) => {
  return c.html(baseLayout('회원가입', `
    <div class="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="bg-white p-8 rounded-lg shadow-lg">
        <h1 class="text-3xl font-bold mb-6 text-center" style="color: var(--ocean);">회원가입</h1>
        <form id="signupForm" class="space-y-4">
          <div><label class="block text-sm font-medium mb-2">이름</label><input type="text" id="name" required class="w-full px-4 py-2 border rounded-lg"></div>
          <div><label class="block text-sm font-medium mb-2">이메일</label><input type="email" id="email" required class="w-full px-4 py-2 border rounded-lg"></div>
          <div><label class="block text-sm font-medium mb-2">비밀번호</label><input type="password" id="password" required class="w-full px-4 py-2 border rounded-lg"></div>
          <div><label class="block text-sm font-medium mb-2">비밀번호 확인</label><input type="password" id="password_confirm" required class="w-full px-4 py-2 border rounded-lg"></div>
          <button type="submit" class="w-full px-6 py-3 ocean-gradient text-white rounded-lg hover:opacity-90 font-semibold">가입하기</button>
        </form>
        <p class="mt-4 text-center text-sm"><a href="/auth/login" class="text-blue-600 hover:text-blue-800">로그인</a></p>
      </div>
    </div>
  `, '', `
    document.getElementById('signupForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const password_confirm = document.getElementById('password_confirm').value;
      
      if (password !== password_confirm) {
        alert('비밀번호가 일치하지 않습니다.'); return;
      }
      
      try {
        await axios.post('/api/auth/signup', { name, email, password });
        alert('회원가입이 완료되었습니다!');
        window.location.href = '/auth/login';
      } catch (error) {
        alert(error.response?.data?.error || '회원가입에 실패했습니다.');
      }
    });
  `));
});

// ============================================
// Admin Page
// ============================================

app.get('/admin', async (c) => {
  return c.html(baseLayout('관리자', `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <h1 class="text-4xl font-bold mb-8" style="color: var(--ocean);">관리자 페이지</h1>
      <div id="adminContent">
        <div class="text-center py-20"><i class="fas fa-spinner fa-spin text-4xl text-gray-400"></i></div>
      </div>
    </div>
  `, '', `
    async function checkAdminAuth() {
      try {
        const response = await axios.get('/api/auth/me');
        const { user } = response.data;
        
        if (!user || !user.is_admin) {
          document.getElementById('adminContent').innerHTML = '<div class="text-center py-20"><p class="text-xl text-red-600">관리자 권한이 필요합니다.</p><a href="/auth/login" class="text-blue-600">로그인</a></div>';
          return;
        }
        
        loadAdminDashboard();
      } catch (error) {
        document.getElementById('adminContent').innerHTML = '<div class="text-center py-20"><p class="text-xl text-red-600">오류가 발생했습니다.</p></div>';
      }
    }
    
    function loadAdminDashboard() {
      document.getElementById('adminContent').innerHTML = \`
        <div class="mb-8">
          <div class="flex space-x-4 border-b overflow-x-auto">
            <button onclick="showTab('products')" id="tab-products" class="px-6 py-3 font-semibold border-b-2 border-blue-600 text-blue-600 whitespace-nowrap">상품 관리</button>
            <button onclick="showTab('events')" id="tab-events" class="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap">이벤트 관리</button>
            <button onclick="showTab('activities')" id="tab-activities" class="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap">활동 관리</button>
            <button onclick="showTab('orders')" id="tab-orders" class="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap">주문 관리</button>
            <button onclick="showTab('reservations')" id="tab-reservations" class="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap">예약 관리</button>
            <button onclick="showTab('members')" id="tab-members" class="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap">회원 관리</button>
            <button onclick="showTab('donations')" id="tab-donations" class="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap">후원 관리</button>
            <button onclick="showTab('articles')" id="tab-articles" class="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap">위기 기사</button>
            <button onclick="showTab('company')" id="tab-company" class="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap">회사 소개</button>
          </div>
        </div>
        
        <div id="tab-content"></div>
      \`;
      
      showTab('products');
    }
    
    function showTab(tab) {
      // Update tab styles
      ['products', 'events', 'activities', 'orders', 'reservations', 'members', 'donations', 'articles', 'company'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        if (t === tab) {
          btn.className = 'px-6 py-3 font-semibold border-b-2 border-blue-600 text-blue-600 whitespace-nowrap';
        } else {
          btn.className = 'px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap';
        }
      });
      
      // Load content
      if (tab === 'products') loadProductsManager();
      else if (tab === 'events') loadEventsManager();
      else if (tab === 'activities') loadActivitiesManager();
      else if (tab === 'orders') loadOrdersManager();
      else if (tab === 'reservations') loadReservationsManager();
      else if (tab === 'members') loadMembersManager();
      else if (tab === 'donations') loadDonationsManager();
      else if (tab === 'articles') loadArticlesManager();
      else if (tab === 'company') loadCompanyInfoManager();
    }
    
    // ============================================
    // Products Manager
    // ============================================
    
    // Common function for image upload
    async function uploadImageFile(fileInputId) {
      const imageFile = document.getElementById(fileInputId).files[0];
      if (!imageFile) return null;
      
      const formData = new FormData();
      formData.append('image', imageFile);
      
      try {
        const uploadResponse = await axios.post('/api/admin/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return uploadResponse.data.url;
      } catch (error) {
        console.error('Upload error:', error);
        throw new Error('이미지 업로드에 실패했습니다.');
      }
    }
    
    // Common function for image preview
    function setupImagePreview(fileInputId, previewId) {
      document.getElementById(fileInputId).addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            document.getElementById(previewId).innerHTML = \`
              <img src="\${e.target.result}" class="max-w-xs rounded-lg shadow-md" alt="미리보기">
            \`;
          };
          reader.readAsDataURL(file);
        }
      });
    }
    
    async function loadProductsManager() {
      try {
        const response = await axios.get('/api/products');
        const { products } = response.data;
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold">상품 목록</h2>
              <button onclick="showAddProductForm()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                <i class="fas fa-plus mr-2"></i>상품 추가
              </button>
            </div>
            
            <div id="products-list" class="space-y-4">
              \${products.map(p => \`
                <div class="border rounded-lg p-4 flex justify-between items-center hover:bg-gray-50">
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold">\${p.name}</h3>
                    <p class="text-gray-600">\${p.description.substring(0, 100)}...</p>
                    <p class="text-blue-600 font-semibold mt-2">\${p.price.toLocaleString()}원 | 재고: \${p.stock}개</p>
                  </div>
                  <div class="space-x-2">
                    <button onclick="editProduct(\${p.id})" class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700">수정</button>
                    <button onclick="deleteProduct(\${p.id})" class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">삭제</button>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      } catch (error) {
        console.error('Load products error:', error);
        alert('상품 목록을 불러오는데 실패했습니다.');
      }
    }
    
    function showAddProductForm() {
      document.getElementById('tab-content').innerHTML = \`
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-2xl font-bold mb-6">상품 추가</h2>
          <form id="addProductForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">상품명 *</label>
              <input type="text" id="product_name" required class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">설명 *</label>
              <textarea id="product_description" required rows="4" class="w-full px-4 py-2 border rounded-lg"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">가격 (원) *</label>
                <input type="number" id="product_price" required min="0" class="w-full px-4 py-2 border rounded-lg">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">재고 수량 *</label>
                <input type="number" id="product_stock" required min="0" value="0" class="w-full px-4 py-2 border rounded-lg">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">이미지</label>
              <div class="space-y-2">
                <input type="file" id="product_image_file" accept="image/*" class="w-full px-4 py-2 border rounded-lg">
                <p class="text-sm text-gray-500">또는 URL 직접 입력:</p>
                <input type="text" id="product_image_url" placeholder="/api/images/..." class="w-full px-4 py-2 border rounded-lg">
                <div id="image_preview" class="mt-2"></div>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">카테고리</label>
              <input type="text" id="product_category" value="eco-goods" class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div class="flex space-x-4">
              <button type="submit" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
              <button type="button" onclick="loadProductsManager()" class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700">취소</button>
            </div>
          </form>
        </div>
      \`;
      
      // Image preview handler
      document.getElementById('product_image_file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            document.getElementById('image_preview').innerHTML = \`
              <img src="\${e.target.result}" class="max-w-xs rounded-lg shadow-md" alt="미리보기">
            \`;
          };
          reader.readAsDataURL(file);
        }
      });
      
      document.getElementById('addProductForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let imageUrl = document.getElementById('product_image_url').value;
        
        // Upload image if file is selected
        const imageFile = document.getElementById('product_image_file').files[0];
        if (imageFile) {
          const formData = new FormData();
          formData.append('image', imageFile);
          
          try {
            const uploadResponse = await axios.post('/api/admin/upload-image', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            imageUrl = uploadResponse.data.url;
          } catch (error) {
            console.error('Upload error:', error);
            alert('이미지 업로드에 실패했습니다.');
            return;
          }
        }
        
        const data = {
          name: document.getElementById('product_name').value,
          description: document.getElementById('product_description').value,
          price: parseInt(document.getElementById('product_price').value),
          stock: parseInt(document.getElementById('product_stock').value),
          image_url: imageUrl || '/static/images/products/default.jpg',
          category: document.getElementById('product_category').value
        };
        
        try {
          await axios.post('/api/admin/products', data);
          alert('상품이 추가되었습니다!');
          loadProductsManager();
        } catch (error) {
          console.error('Add product error:', error);
          alert('상품 추가에 실패했습니다.');
        }
      });
    }
    
    async function editProduct(id) {
      try {
        const response = await axios.get('/api/products/' + id);
        const p = response.data.product;
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-6">상품 수정</h2>
            <form id="editProductForm" class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-2">상품명 *</label>
                <input type="text" id="product_name" value="\${p.name.replace(/"/g, '&quot;')}" required class="w-full px-4 py-2 border rounded-lg">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">설명 *</label>
                <textarea id="product_description" required rows="4" class="w-full px-4 py-2 border rounded-lg">\${p.description}</textarea>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-2">가격 (원) *</label>
                  <input type="number" id="product_price" value="\${p.price}" required min="0" class="w-full px-4 py-2 border rounded-lg">
                </div>
                <div>
                  <label class="block text-sm font-medium mb-2">재고 수량 *</label>
                  <input type="number" id="product_stock" value="\${p.stock}" required min="0" class="w-full px-4 py-2 border rounded-lg">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">이미지</label>
                <div class="space-y-2">
                  \${p.image_url ? \`<img src="\${p.image_url}" class="max-w-xs rounded-lg shadow-md mb-2" alt="현재 이미지">\` : ''}
                  <input type="file" id="product_image_file" accept="image/*" class="w-full px-4 py-2 border rounded-lg">
                  <p class="text-sm text-gray-500">새 이미지를 선택하거나 URL 직접 수정:</p>
                  <input type="text" id="product_image_url" value="\${p.image_url || ''}" class="w-full px-4 py-2 border rounded-lg">
                  <div id="image_preview" class="mt-2"></div>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">카테고리</label>
                <input type="text" id="product_category" value="\${p.category}" class="w-full px-4 py-2 border rounded-lg">
              </div>
              <div class="flex space-x-4">
                <button type="submit" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
                <button type="button" onclick="loadProductsManager()" class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700">취소</button>
              </div>
            </form>
          </div>
        \`;
        
        // Image preview handler
        document.getElementById('product_image_file').addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
              document.getElementById('image_preview').innerHTML = \`
                <img src="\${e.target.result}" class="max-w-xs rounded-lg shadow-md" alt="미리보기">
              \`;
            };
            reader.readAsDataURL(file);
          }
        });
        
        document.getElementById('editProductForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          let imageUrl = document.getElementById('product_image_url').value;
          
          // Upload image if file is selected
          const imageFile = document.getElementById('product_image_file').files[0];
          if (imageFile) {
            const formData = new FormData();
            formData.append('image', imageFile);
            
            try {
              const uploadResponse = await axios.post('/api/admin/upload-image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
              imageUrl = uploadResponse.data.url;
            } catch (error) {
              console.error('Upload error:', error);
              alert('이미지 업로드에 실패했습니다.');
              return;
            }
          }
          
          const data = {
            name: document.getElementById('product_name').value,
            description: document.getElementById('product_description').value,
            price: parseInt(document.getElementById('product_price').value),
            stock: parseInt(document.getElementById('product_stock').value),
            image_url: imageUrl,
            category: document.getElementById('product_category').value
          };
          
          try {
            await axios.put('/api/admin/products/' + id, data);
            alert('상품이 수정되었습니다!');
            loadProductsManager();
          } catch (error) {
            console.error('Edit product error:', error);
            alert('상품 수정에 실패했습니다.');
          }
        });
      } catch (error) {
        console.error('Get product error:', error);
        alert('상품 정보를 불러오는데 실패했습니다.');
      }
    }
    
    async function deleteProduct(id) {
      if (!confirm('정말 이 상품을 삭제하시겠습니까?')) return;
      
      try {
        await axios.delete('/api/admin/products/' + id);
        alert('상품이 삭제되었습니다!');
        loadProductsManager();
      } catch (error) {
        console.error('Delete product error:', error);
        alert('상품 삭제에 실패했습니다.');
      }
    }
    
    // ============================================
    // Events Manager
    // ============================================
    async function loadEventsManager() {
      try {
        const response = await axios.get('/api/events');
        const { events } = response.data;
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold">이벤트 목록</h2>
              <button onclick="showAddEventForm()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                <i class="fas fa-plus mr-2"></i>이벤트 추가
              </button>
            </div>
            
            <div class="space-y-4">
              \${events.map(e => \`
                <div class="border rounded-lg p-4 flex justify-between items-center hover:bg-gray-50">
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold">\${e.title}</h3>
                    <p class="text-gray-600">\${e.content.substring(0, 100)}...</p>
                    <p class="text-sm text-gray-500 mt-2">
                      <i class="fas fa-calendar mr-1"></i>\${e.event_date || '일정 미정'} | 
                      <i class="fas fa-map-marker-alt ml-2 mr-1"></i>\${e.location || '장소 미정'}
                    </p>
                  </div>
                  <button onclick="deleteEvent(\${e.id})" class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">삭제</button>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      } catch (error) {
        console.error('Load events error:', error);
        alert('이벤트 목록을 불러오는데 실패했습니다.');
      }
    }
    
    function showAddEventForm() {
      document.getElementById('tab-content').innerHTML = \`
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-2xl font-bold mb-6">이벤트 추가</h2>
          <form id="addEventForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">제목 *</label>
              <input type="text" id="event_title" required class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">내용 *</label>
              <textarea id="event_content" required rows="6" class="w-full px-4 py-2 border rounded-lg"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">일정</label>
                <input type="text" id="event_date" placeholder="2024-06-15" class="w-full px-4 py-2 border rounded-lg">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">장소</label>
                <input type="text" id="event_location" placeholder="제주도 협재해수욕장" class="w-full px-4 py-2 border rounded-lg">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">이미지</label>
              <div class="space-y-2">
                <input type="file" id="event_image_file" accept="image/*" class="w-full px-4 py-2 border rounded-lg">
                <p class="text-sm text-gray-500">또는 URL 직접 입력:</p>
                <input type="text" id="event_image_url" placeholder="/api/images/..." class="w-full px-4 py-2 border rounded-lg">
                <div id="event_image_preview" class="mt-2"></div>
              </div>
            </div>
            <div class="flex space-x-4">
              <button type="submit" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
              <button type="button" onclick="loadEventsManager()" class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700">취소</button>
            </div>
          </form>
        </div>
      \`;
      
      setupImagePreview('event_image_file', 'event_image_preview');
      
      document.getElementById('addEventForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let imageUrl = document.getElementById('event_image_url').value;
        
        try {
          const uploadedUrl = await uploadImageFile('event_image_file');
          if (uploadedUrl) imageUrl = uploadedUrl;
        } catch (error) {
          alert(error.message);
          return;
        }
        
        const data = {
          title: document.getElementById('event_title').value,
          content: document.getElementById('event_content').value,
          event_date: document.getElementById('event_date').value || null,
          location: document.getElementById('event_location').value || null,
          image_url: imageUrl || null
        };
        
        try {
          await axios.post('/api/admin/events', data);
          alert('이벤트가 추가되었습니다!');
          loadEventsManager();
        } catch (error) {
          console.error('Add event error:', error);
          alert('이벤트 추가에 실패했습니다.');
        }
      });
    }
    
    async function deleteEvent(id) {
      if (!confirm('정말 이 이벤트를 삭제하시겠습니까?')) return;
      
      try {
        await axios.delete('/api/admin/events/' + id);
        alert('이벤트가 삭제되었습니다!');
        loadEventsManager();
      } catch (error) {
        console.error('Delete event error:', error);
        alert('이벤트 삭제에 실패했습니다.');
      }
    }
    
    // ============================================
    // Activities Manager
    // ============================================
    async function loadActivitiesManager() {
      try {
        const response = await axios.get('/api/activities');
        const { activities } = response.data;
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold">활동 목록</h2>
              <button onclick="showAddActivityForm()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                <i class="fas fa-plus mr-2"></i>활동 추가
              </button>
            </div>
            
            <div class="space-y-4">
              \${activities.map(a => \`
                <div class="border rounded-lg p-4 flex justify-between items-center hover:bg-gray-50">
                  <div class="flex-1">
                    <h3 class="text-lg font-semibold">\${a.title}</h3>
                    <p class="text-gray-600">\${a.content.substring(0, 100)}...</p>
                    <p class="text-sm text-gray-500 mt-2">
                      <i class="fas fa-calendar mr-1"></i>\${a.activity_date || '날짜 미정'} | 
                      <i class="fas fa-map-marker-alt ml-2 mr-1"></i>\${a.location || '장소 미정'}
                    </p>
                  </div>
                  <button onclick="deleteActivity(\${a.id})" class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">삭제</button>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      } catch (error) {
        console.error('Load activities error:', error);
        alert('활동 목록을 불러오는데 실패했습니다.');
      }
    }
    
    function showAddActivityForm() {
      document.getElementById('tab-content').innerHTML = \`
        <div class="bg-white rounded-lg shadow-lg p-6">
          <h2 class="text-2xl font-bold mb-6">활동 추가</h2>
          <form id="addActivityForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">제목 *</label>
              <input type="text" id="activity_title" required class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">내용 *</label>
              <textarea id="activity_content" required rows="6" class="w-full px-4 py-2 border rounded-lg"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-2">날짜</label>
                <input type="text" id="activity_date" placeholder="2024-03-15" class="w-full px-4 py-2 border rounded-lg">
              </div>
              <div>
                <label class="block text-sm font-medium mb-2">장소</label>
                <input type="text" id="activity_location" placeholder="강릉 경포해변" class="w-full px-4 py-2 border rounded-lg">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">이미지</label>
              <div class="space-y-2">
                <input type="file" id="activity_image_file" accept="image/*" class="w-full px-4 py-2 border rounded-lg">
                <p class="text-sm text-gray-500">또는 URL 직접 입력:</p>
                <input type="text" id="activity_image_url" placeholder="/api/images/..." class="w-full px-4 py-2 border rounded-lg">
                <div id="activity_image_preview" class="mt-2"></div>
              </div>
            </div>
            <div class="flex space-x-4">
              <button type="submit" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
              <button type="button" onclick="loadActivitiesManager()" class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700">취소</button>
            </div>
          </form>
        </div>
      \`;
      
      setupImagePreview('activity_image_file', 'activity_image_preview');
      
      document.getElementById('addActivityForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let imageUrl = document.getElementById('activity_image_url').value;
        
        try {
          const uploadedUrl = await uploadImageFile('activity_image_file');
          if (uploadedUrl) imageUrl = uploadedUrl;
        } catch (error) {
          alert(error.message);
          return;
        }
        
        const data = {
          title: document.getElementById('activity_title').value,
          content: document.getElementById('activity_content').value,
          activity_date: document.getElementById('activity_date').value || null,
          location: document.getElementById('activity_location').value || null,
          image_url: imageUrl || null
        };
        
        try {
          await axios.post('/api/admin/activities', data);
          alert('활동이 추가되었습니다!');
          loadActivitiesManager();
        } catch (error) {
          console.error('Add activity error:', error);
          alert('활동 추가에 실패했습니다.');
        }
      });
    }
    
    async function deleteActivity(id) {
      if (!confirm('정말 이 활동을 삭제하시겠습니까?')) return;
      
      try {
        await axios.delete('/api/admin/activities/' + id);
        alert('활동이 삭제되었습니다!');
        loadActivitiesManager();
      } catch (error) {
        console.error('Delete activity error:', error);
        alert('활동 삭제에 실패했습니다.');
      }
    }
    
    // ============================================
    // Orders Manager
    // ============================================
    async function loadOrdersManager() {
      try {
        const response = await axios.get('/api/admin/orders');
        const { orders } = response.data;
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-6">주문 관리</h2>
            <div class="space-y-4">
              \${orders.length === 0 ? '<p class="text-center text-gray-600 py-8">주문이 없습니다.</p>' : orders.map(o => \`
                <div class="border rounded-lg p-4 hover:bg-gray-50">
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <h3 class="text-lg font-semibold">주문번호: \${o.order_number}</h3>
                      <p class="text-sm text-gray-600">고객명: \${o.shipping_name} | 전화번호: \${o.shipping_phone}</p>
                      <p class="text-sm text-gray-600">배송지: \${o.shipping_address}</p>
                    </div>
                    <div class="text-right">
                      <p class="text-lg font-bold text-blue-600">\${o.total_amount.toLocaleString()}원</p>
                      <p class="text-sm text-gray-500">\${new Date(o.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                  </div>
                  
                  <!-- 주문 상품 목록 -->
                  \${o.items && o.items.length > 0 ? \`
                    <div class="mt-3 pt-3 border-t">
                      <p class="text-sm font-semibold mb-2">주문 상품:</p>
                      <div class="space-y-1">
                        \${o.items.map(item => \`
                          <div class="flex items-center text-sm text-gray-700">
                            <span class="font-medium">\${item.product_name || '상품명 없음'}</span>
                            <span class="mx-2">×</span>
                            <span>\${item.quantity}개</span>
                            <span class="mx-2">-</span>
                            <span class="text-blue-600">\${(item.price * item.quantity).toLocaleString()}원</span>
                          </div>
                        \`).join('')}
                      </div>
                    </div>
                  \` : ''}
                  
                  <div class="mt-2 pt-2 border-t">
                    <span class="px-3 py-1 rounded-full text-sm \${o.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                      \${o.status === 'pending' ? '대기중' : '완료'}
                    </span>
                  </div>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
      } catch (error) {
        console.error('Load orders error:', error);
        alert('주문 목록을 불러오는데 실패했습니다.');
      }
    }
    
    // ============================================
    // Reservations Manager
    // ============================================
    
    async function loadReservationsManager() {
      try {
        const response = await axios.get('/api/admin/reservations');
        const { reservations } = response.data;
        
        // Group by event
        const byEvent = {};
        reservations.forEach(r => {
          if (!byEvent[r.event_id]) {
            byEvent[r.event_id] = {
              event_title: r.event_title,
              reservations: [],
              totalParticipants: 0
            };
          }
          byEvent[r.event_id].reservations.push(r);
          byEvent[r.event_id].totalParticipants += r.participants;
        });
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-6">예약 관리</h2>
            <div class="space-y-6">
              \${Object.keys(byEvent).length === 0 ? '<p class="text-center text-gray-600 py-8">예약이 없습니다.</p>' : 
                Object.values(byEvent).map(event => \`
                  <div class="border rounded-lg p-4">
                    <div class="flex justify-between items-center mb-4">
                      <h3 class="text-xl font-semibold">\${event.event_title}</h3>
                      <span class="px-4 py-2 bg-blue-100 text-blue-800 rounded-full font-semibold">
                        총 \${event.totalParticipants}명
                      </span>
                    </div>
                    <div class="space-y-2">
                      \${event.reservations.map(r => \`
                        <div class="flex justify-between items-center p-3 bg-gray-50 rounded">
                          <div>
                            <p class="font-medium">\${r.name}</p>
                            <p class="text-sm text-gray-600">\${r.email} | \${r.phone}</p>
                          </div>
                          <div class="text-right">
                            <p class="font-semibold">\${r.participants}명</p>
                            <p class="text-xs text-gray-500">\${new Date(r.created_at).toLocaleDateString('ko-KR')}</p>
                          </div>
                        </div>
                      \`).join('')}
                    </div>
                  </div>
                \`).join('')
              }
            </div>
          </div>
        \`;
      } catch (error) {
        console.error('Load reservations error:', error);
        alert('예약 목록을 불러오는데 실패했습니다.');
      }
    }
    
    // ============================================
    // Members Manager
    // ============================================
    
    async function loadMembersManager() {
      try {
        const response = await axios.get('/api/admin/members');
        const { members } = response.data;
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-6">회원 관리</h2>
            <div class="mb-4">
              <p class="text-gray-600">총 회원 수: <span class="font-bold text-blue-600">\${members.length}명</span></p>
            </div>
            <div class="space-y-4">
              \${members.length === 0 ? '<p class="text-center text-gray-600 py-8">회원이 없습니다.</p>' : 
                members.map(m => \`
                  <div class="border rounded-lg p-4 hover:bg-gray-50">
                    <div class="flex justify-between items-start">
                      <div>
                        <h3 class="text-lg font-semibold">\${m.name}</h3>
                        <p class="text-sm text-gray-600">\${m.email}</p>
                        <p class="text-xs text-gray-500 mt-1">가입일: \${new Date(m.created_at).toLocaleDateString('ko-KR')}</p>
                      </div>
                      <div>
                        \${m.is_admin ? 
                          '<span class="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">관리자</span>' : 
                          '<span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">일반 회원</span>'
                        }
                      </div>
                    </div>
                  </div>
                \`).join('')
              }
            </div>
          </div>
        \`;
      } catch (error) {
        console.error('Load members error:', error);
        alert('회원 목록을 불러오는데 실패했습니다.');
      }
    }
    
    // ============================================
    // Donations Manager
    // ============================================
    
    async function loadDonationsManager() {
      try {
        const response = await axios.get('/api/admin/donations');
        const { donations } = response.data;
        
        // Calculate statistics
        const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
        const activeDonations = donations.filter(d => d.status === 'active');
        const monthlyTotal = activeDonations.reduce((sum, d) => sum + d.amount, 0);
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-6">정기 후원 관리</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div class="bg-blue-50 p-4 rounded-lg">
                <p class="text-sm text-gray-600 mb-1">총 후원자</p>
                <p class="text-2xl font-bold text-blue-600">\${donations.length}명</p>
              </div>
              <div class="bg-green-50 p-4 rounded-lg">
                <p class="text-sm text-gray-600 mb-1">활성 후원자</p>
                <p class="text-2xl font-bold text-green-600">\${activeDonations.length}명</p>
              </div>
              <div class="bg-purple-50 p-4 rounded-lg">
                <p class="text-sm text-gray-600 mb-1">월 정기 후원액</p>
                <p class="text-2xl font-bold text-purple-600">\${monthlyTotal.toLocaleString()}원</p>
              </div>
            </div>
            
            <div class="space-y-4">
              \${donations.length === 0 ? '<p class="text-center text-gray-600 py-8">후원자가 없습니다.</p>' : 
                donations.map(d => \`
                  <div class="border rounded-lg p-4 hover:bg-gray-50">
                    <div class="flex justify-between items-start">
                      <div>
                        <h3 class="text-lg font-semibold">\${d.donor_name}</h3>
                        <p class="text-sm text-gray-600">\${d.donor_email} | \${d.donor_phone}</p>
                        <p class="text-xs text-gray-500 mt-1">신청일: \${new Date(d.created_at).toLocaleDateString('ko-KR')}</p>
                      </div>
                      <div class="text-right">
                        <p class="text-xl font-bold text-blue-600">\${d.amount.toLocaleString()}원/월</p>
                        <span class="inline-block mt-2 px-3 py-1 rounded-full text-sm \${
                          d.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }">
                          \${d.status === 'active' ? '활성' : '중단'}
                        </span>
                      </div>
                    </div>
                  </div>
                \`).join('')
              }
            </div>
          </div>
        \`;
      } catch (error) {
        console.error('Load donations error:', error);
        alert('후원 목록을 불러오는데 실패했습니다.');
      }
    }
    
    // ============================================
    // Crisis Articles Manager
    // ============================================
    
    async function loadArticlesManager() {
      try {
        const response = await axios.get('/api/crisis-articles');
        const { articles } = response.data;
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="flex justify-between items-center mb-6">
              <h2 class="text-2xl font-bold">해양 위기 기사 관리</h2>
              <button onclick="showAddArticleForm()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <i class="fas fa-plus mr-2"></i>기사 추가
              </button>
            </div>
            <div id="articlesContent" class="space-y-4">
              \${articles.length === 0 ? '<p class="text-center text-gray-600 py-8">기사가 없습니다.</p>' : 
                articles.map(a => \`
                  <div class="border rounded-lg p-4 hover:bg-gray-50">
                    <div class="flex justify-between items-start">
                      <div class="flex-1">
                        <h3 class="text-lg font-semibold mb-2">\${a.title}</h3>
                        <p class="text-sm text-gray-600 mb-2">\${a.content.substring(0, 150)}...</p>
                        \${a.source ? \`<p class="text-xs text-gray-500">출처: \${a.source}</p>\` : ''}
                        \${a.source_url ? \`<p class="text-xs text-blue-600"><a href="\${a.source_url}" target="_blank">링크 보기</a></p>\` : ''}
                        <p class="text-xs text-gray-500 mt-2">발행일: \${a.published_date || '미정'}</p>
                      </div>
                      <button onclick="deleteArticle(\${a.id})" class="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">
                        삭제
                      </button>
                    </div>
                  </div>
                \`).join('')
              }
            </div>
          </div>
        \`;
      } catch (error) {
        console.error('Load articles error:', error);
        alert('기사 목록을 불러오는데 실패했습니다.');
      }
    }
    
    function showAddArticleForm() {
      document.getElementById('articlesContent').innerHTML = \`
        <div class="bg-gray-50 p-6 rounded-lg">
          <h3 class="text-xl font-bold mb-4">기사 추가</h3>
          <form id="addArticleForm" class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">제목 *</label>
              <input type="text" id="article_title" required class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">내용 *</label>
              <textarea id="article_content" required rows="6" class="w-full px-4 py-2 border rounded-lg"></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">출처</label>
              <input type="text" id="article_source" class="w-full px-4 py-2 border rounded-lg" placeholder="예: 한국일보">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">출처 링크 (URL)</label>
              <input type="url" id="article_source_url" class="w-full px-4 py-2 border rounded-lg" placeholder="https://...">
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">이미지</label>
              <div class="space-y-2">
                <input type="file" id="article_image_file" accept="image/*" class="w-full px-4 py-2 border rounded-lg">
                <input type="text" id="article_image_url" class="w-full px-4 py-2 border rounded-lg" placeholder="또는 이미지 URL 입력">
                <div id="article_image_preview" class="mt-2"></div>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">카테고리</label>
              <select id="article_category" class="w-full px-4 py-2 border rounded-lg">
                <option value="general">일반</option>
                <option value="pollution">해양 오염</option>
                <option value="climate">기후 변화</option>
                <option value="ecosystem">생태계</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-2">발행일</label>
              <input type="date" id="article_date" class="w-full px-4 py-2 border rounded-lg">
            </div>
            <div class="flex space-x-4">
              <button type="submit" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
              <button type="button" onclick="loadArticlesManager()" class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700">취소</button>
            </div>
          </form>
        </div>
      \`;
      
      // Image file preview
      document.getElementById('article_image_file').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            document.getElementById('article_image_preview').innerHTML = '<img src="' + e.target.result + '" class="max-w-xs rounded-lg" />';
          };
          reader.readAsDataURL(file);
        }
      });
      
      document.getElementById('addArticleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let imageUrl = document.getElementById('article_image_url').value;
        
        // Upload image file if selected
        const imageFile = document.getElementById('article_image_file').files[0];
        if (imageFile) {
          const formData = new FormData();
          formData.append('image', imageFile);
          
          try {
            const uploadRes = await axios.post('/api/admin/upload-image', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
            imageUrl = uploadRes.data.url;
          } catch (error) {
            console.error('Image upload error:', error);
            alert('이미지 업로드 중 오류가 발생했습니다.');
            return;
          }
        }
        
        const data = {
          title: document.getElementById('article_title').value,
          content: document.getElementById('article_content').value,
          source: document.getElementById('article_source').value,
          source_url: document.getElementById('article_source_url').value,
          image_url: imageUrl,
          category: document.getElementById('article_category').value,
          published_date: document.getElementById('article_date').value
        };
        
        try {
          await axios.post('/api/admin/crisis-articles', data);
          alert('기사가 추가되었습니다!');
          loadArticlesManager();
        } catch (error) {
          console.error('Add article error:', error);
          alert('기사 추가 중 오류가 발생했습니다.');
        }
      });
    }
    
    async function deleteArticle(id) {
      if (!confirm('이 기사를 삭제하시겠습니까?')) return;
      
      try {
        await axios.delete('/api/admin/crisis-articles/' + id);
        alert('기사가 삭제되었습니다!');
        loadArticlesManager();
      } catch (error) {
        console.error('Delete article error:', error);
        alert('기사 삭제 중 오류가 발생했습니다.');
      }
    }
    
    // ============================================
    // Company Info Manager  
    // ============================================
    
    async function loadCompanyInfoManager() {
      try {
        const response = await axios.get('/api/company-info');
        const { info } = response.data;
        
        document.getElementById('tab-content').innerHTML = \`
          <div class="bg-white rounded-lg shadow-lg p-6">
            <h2 class="text-2xl font-bold mb-6">회사 소개 관리</h2>
            <div class="space-y-6">
              \${info.map(item => \`
                <div class="border rounded-lg p-4">
                  <h3 class="text-lg font-semibold mb-3">\${item.title || item.section}</h3>
                  <form id="form-\${item.section}" class="space-y-3">
                    <div>
                      <label class="block text-sm font-medium mb-2">제목</label>
                      <input type="text" id="title-\${item.section}" value="\${item.title || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div>
                      <label class="block text-sm font-medium mb-2">내용 *</label>
                      <textarea id="content-\${item.section}" rows="4" class="w-full px-4 py-2 border rounded-lg">\${item.content}</textarea>
                    </div>
                    <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">저장</button>
                  </form>
                </div>
              \`).join('')}
            </div>
          </div>
        \`;
        
        // Add event listeners
        info.forEach(item => {
          document.getElementById('form-' + item.section).addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
              title: document.getElementById('title-' + item.section).value,
              content: document.getElementById('content-' + item.section).value
            };
            
            try {
              await axios.put('/api/admin/company-info/' + item.section, data);
              alert('회사 정보가 업데이트되었습니다!');
            } catch (error) {
              console.error('Update company info error:', error);
              alert('회사 정보 업데이트 중 오류가 발생했습니다.');
            }
          });
        });
      } catch (error) {
        console.error('Load company info error:', error);
        alert('회사 정보를 불러오는데 실패했습니다.');
      }
    }
    
    checkAdminAuth();
  `));
});

// ============================================
// 404 Page
// ============================================

app.notFound((c) => {
  return c.html(baseLayout('404', `
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
      <i class="fas fa-compass text-8xl text-gray-400 mb-6"></i>
      <h1 class="text-5xl font-bold mb-4" style="color: var(--ocean);">길을 잃으셨나요?</h1>
      <p class="text-xl text-gray-600 mb-8">요청하신 페이지를 찾을 수 없습니다.</p>
      <a href="/" class="inline-block px-8 py-4 ocean-gradient text-white rounded-lg hover:opacity-90 text-lg font-semibold">
        홈으로 돌아가기
      </a>
    </div>
  `));
});

export default app;
