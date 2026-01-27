export type Bindings = {
  DB: D1Database;
}

export type User = {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  password_salt: string;
  is_admin: number;
  created_at: string;
}

export type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  stock: number;
  created_at: string;
  updated_at: string;
}

export type Order = {
  id: number;
  user_id: number | null;
  order_number: string;
  total_amount: number;
  status: string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  shipping_zipcode: string | null;
  payment_method: string | null;
  payment_status: string;
  created_at: string;
}

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

export type Event = {
  id: number;
  title: string;
  content: string;
  image_url: string | null;
  event_date: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export type Activity = {
  id: number;
  title: string;
  content: string;
  image_url: string | null;
  activity_date: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}
