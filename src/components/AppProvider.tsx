"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Branding, LinkRecord, PublicUser, VisitorLog } from "@/lib/types";
import {
  api,
  getDeviceId,
  getPhone,
  getSoundPref,
  getUserToken,
  setPhone as persistPhone,
  setSoundPref,
  setUserCache,
} from "@/lib/client";
import { playBubble } from "@/lib/audio";

export type Tab = "create" | "analytics" | "media" | "recent";
export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface AppState {
  /* branding */
  branding: Branding;
  setBranding: (b: Branding) => void;

  /* navigation */
  tab: Tab;
  setTab: (t: Tab) => void;

  /* links */
  links: LinkRecord[];
  loadingLinks: boolean;
  refreshLinks: () => Promise<void>;
  upsertLink: (link: LinkRecord) => void;
  removeLink: (code: string) => void;

  /* identity */
  deviceId: string | null;
  phone: string;
  setPhone: (value: string) => void;
  user: PublicUser | null;
  setUser: (user: PublicUser | null) => void;

  /* audio */
  soundOn: boolean;
  toggleSoundOn: () => void;
  click: (freq?: number) => void;

  /* feedback */
  toasts: ToastItem[];
  toast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;

  /* selected analytics target */
  selected: LinkRecord | null;
  setSelected: (link: LinkRecord | null) => void;

  /* overlays */
  authOpen: boolean;
  authMode: "login" | "register";
  openAuth: (mode?: "login" | "register") => void;
  closeAuth: () => void;

  couponOpen: boolean;
  setCouponOpen: (v: boolean) => void;

  apiHubOpen: boolean;
  setApiHubOpen: (v: boolean) => void;

  exportOpen: boolean;
  setExportOpen: (v: boolean) => void;

  manageCode: string | null;
  setManageCode: (code: string | null) => void;

  deviceInfo: VisitorLog | null;
  setDeviceInfo: (log: VisitorLog | null) => void;

  lightbox: string | null;
  setLightbox: (src: string | null) => void;

  /* browser helpers */
  origin: string;
}

const DEFAULTS: Branding = {
  displayName: "Muhammad Saqib",
  brandName: "Saqib Visuals",
  avatarUrl: "https://ik.imagekit.io/mrsaqib/mrsaqib242-img25_7oG52NZUY.png",
};

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULTS);
  const [tab, setTabState] = useState<Tab>("create");
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [phone, setPhoneState] = useState("");
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [selected, setSelected] = useState<LinkRecord | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [couponOpen, setCouponOpen] = useState(false);
  const [apiHubOpen, setApiHubOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [manageCode, setManageCode] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<VisitorLog | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const soundRef = useRef(true);
  const toastSeq = useRef(0);

  /* ------------------------------ bootstrap ------------------------------ */
  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
    setPhoneState(getPhone());
    setOrigin(window.location.origin);

    const pref = getSoundPref();
    setSoundOn(pref);
    soundRef.current = pref;

    api
      .settings()
      .then((s) =>
        setBranding({
          displayName: s.displayName || DEFAULTS.displayName,
          brandName: s.brandName || DEFAULTS.brandName,
          avatarUrl: s.avatarUrl || DEFAULTS.avatarUrl,
        }),
      )
      .catch(() => setBranding(DEFAULTS));

    if (getUserToken()) {
      api
        .profile()
        .then((r) => {
          setUserState(r.authenticated ? r.user : null);
          setUserCache(r.authenticated ? r.user : null);
        })
        .catch(() => setUserState(null));
    }
  }, []);

  /* --------------------------------- audio -------------------------------- */
  const click = useCallback((freq = 580) => {
    if (!soundRef.current) return;
    playBubble(freq);
  }, []);

  const toggleSoundOn = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      soundRef.current = next;
      setSoundPref(next);
      if (next) playBubble(660);
      return next;
    });
  }, []);

  /* --------------------------------- toast -------------------------------- */
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((prev) => [...prev.slice(-2), { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  /* --------------------------------- links -------------------------------- */
  const refreshLinks = useCallback(async () => {
    if (!deviceId && !phone && !user) {
      setLinks([]);
      return;
    }
    setLoadingLinks(true);
    try {
      const res = await api.listLinks(deviceId, phone);
      setLinks(res.links || []);
    } catch {
      /* offline / unauthorised: keep whatever we already display */
    } finally {
      setLoadingLinks(false);
    }
  }, [deviceId, phone, user]);

  useEffect(() => {
    void refreshLinks();
  }, [refreshLinks]);

  const upsertLink = useCallback((link: LinkRecord) => {
    setLinks((prev) => {
      const rest = prev.filter((l) => l.short_code !== link.short_code);
      return [link, ...rest];
    });
  }, []);

  const removeLink = useCallback((code: string) => {
    setLinks((prev) => prev.filter((l) => l.short_code !== code));
    setSelected((cur) => (cur && cur.short_code === code ? null : cur));
  }, []);

  /* ------------------------------- identity ------------------------------- */
  const setPhone = useCallback((value: string) => {
    setPhoneState(value);
    persistPhone(value);
  }, []);

  const setUser = useCallback((next: PublicUser | null) => {
    setUserState(next);
    setUserCache(next);
  }, []);

  const setTab = useCallback((next: Tab) => {
    setTabState(next);
  }, []);

  const openAuth = useCallback((mode: "login" | "register" = "register") => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const value = useMemo<AppState>(
    () => ({
      branding,
      setBranding,
      tab,
      setTab,
      links,
      loadingLinks,
      refreshLinks,
      upsertLink,
      removeLink,
      deviceId,
      phone,
      setPhone,
      user,
      setUser,
      soundOn,
      toggleSoundOn,
      click,
      toasts,
      toast,
      dismissToast,
      selected,
      setSelected,
      authOpen,
      authMode,
      openAuth,
      closeAuth,
      couponOpen,
      setCouponOpen,
      apiHubOpen,
      setApiHubOpen,
      exportOpen,
      setExportOpen,
      manageCode,
      setManageCode,
      deviceInfo,
      setDeviceInfo,
      lightbox,
      setLightbox,
      origin,
    }),
    [
      branding,
      tab,
      links,
      loadingLinks,
      refreshLinks,
      upsertLink,
      removeLink,
      deviceId,
      phone,
      setPhone,
      user,
      setUser,
      soundOn,
      toggleSoundOn,
      click,
      toasts,
      toast,
      dismissToast,
      selected,
      authOpen,
      authMode,
      openAuth,
      closeAuth,
      couponOpen,
      apiHubOpen,
      exportOpen,
      manageCode,
      deviceInfo,
      lightbox,
      origin,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}