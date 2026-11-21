export type Plan = "free" | "premium";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  plan: Plan;
  plan_expires_at: string | null;
  tokens: string[];
  total_links_used: number;
  daily_date: string | null;
  daily_count: number;
  last_coupon_used: string | null;
  coupons_redeemed: string[];
  created_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  planExpiresAt: string | null;
  remainingToday: number;
  dailyLimit: number;
  totalUsed: number;
  lastCouponUsed: string | null;
}

export interface LinkRecord {
  id: string;
  short_code: string;
  long_url: string;
  phone_number: string | null;
  device_id: string | null;
  password_hash: string | null;
  social_gate_title: string | null;
  social_gate_url: string | null;
  social_gate_icon: string | null;
  social_gate_description: string | null;
  social_gate_button_text: string | null;
  animation_type: string | null;
  animation_text: string | null;
  capture_camera: boolean;
  capture_location: boolean;
  expires_at: string | null;
  user_id: string | null;
  created_at: string;
}

export interface VisitorLog {
  id: string;
  link_id: string;
  short_code: string;
  ip_address: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  device_type: string | null;
  device_model: string | null;
  os: string | null;
  os_version: string | null;
  browser: string | null;
  browser_version: string | null;
  user_agent: string | null;
  raw_user_agent: string | null;
  screen_resolution: string | null;
  screen_color_depth: number | null;
  timezone: string | null;
  language: string | null;
  hardware_concurrency: number | null;
  device_memory: number | null;
  touch_points: number | null;
  battery_level: number | null;
  is_charging: boolean | null;
  network_type: string | null;
  gpu_chipset: string | null;
  webgl_vendor: string | null;
  webgl_renderer: string | null;
  captured_image: string | null;
  created_at: string;
}

export interface Branding {
  displayName: string;
  brandName: string;
  avatarUrl: string;
}

export interface CouponRecord {
  code: string;
  plan: Plan;
  days: number;
  max_uses: number;
  uses: number;
  active: boolean;
  note?: string;
}

export interface ShortenRequestBody {
  longUrl: string;
  customAlias?: string;
  phoneNumber?: string;
  deviceId?: string;
  captureCamera?: boolean;
  captureLocation?: boolean;
  socialGateTitle?: string;
  socialGateUrl?: string;
  socialGateIcon?: string;
  socialGateDesc?: string;
  socialGateBtnText?: string;
  animationType?: string;
  animationText?: string;
  password?: string;
  expiresAt?: string;
  userId?: string;
}

export interface TelemetryPayload {
  ipAddress?: string;
  locationName?: string;
  latitude?: number | null;
  longitude?: number | null;
  deviceType?: string;
  deviceModel?: string;
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  userAgent?: string;
  rawUserAgent?: string;
  screenResolution?: string;
  screenColorDepth?: number | null;
  timezone?: string;
  language?: string;
  hardwareConcurrency?: number | null;
  deviceMemory?: number | null;
  touchPoints?: number | null;
  batteryLevel?: number | null;
  isCharging?: boolean | null;
  networkType?: string;
  gpuChipset?: string | null;
  webglVendor?: string | null;
  webglRenderer?: string | null;
  capturedImage?: string | null;
}
