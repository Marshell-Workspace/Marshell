"use client";

import { GoogleGLogo } from "@workspace/core/components/common/ai-cli-logos";
import { getDisplayInitials } from "@workspace/core/components/navigation/user-nav";
import getCroppedImg from "@workspace/core/lib/crop-image";
import { openExternalUrl } from "@workspace/core/lib/open-url";
import { safeJsonParse } from "@workspace/core/lib/safe-json";
import {
  type AuthSession,
  useAuthStore,
} from "@workspace/core/stores/auth-store";
import { usePanelStore } from "@workspace/core/stores/panel-store";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Monitor } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import Cropper from "react-easy-crop";
import { toast } from "sonner";

const PROFILE_STORAGE_KEY = "marshell_account_profile";
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;

export interface AccountProfile {
  avatarUrl: string;
  displayName: string;
  email: string;
  initials: string;
  username: string;
}

export interface GoogleAuthState {
  connected: boolean;
  email?: string;
  label: string;
  showGitHub: boolean;
  status: "connected" | "error" | "loading" | "not-connected";
}

function detectDeviceName(): string {
  if (typeof navigator === "undefined") {
    return "This device";
  }
  const ua = navigator.userAgent || "";
  if (/Windows/i.test(ua)) {
    return "Windows PC";
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return "Mac";
  }
  if (/Linux/i.test(ua)) {
    return "Linux PC";
  }
  if (/Android/i.test(ua)) {
    return "Android Device";
  }
  if (/iPhone|iPad/i.test(ua)) {
    return "iOS Device";
  }
  return "This device";
}

export function getInitials(
  name?: string | null,
  email?: string | null
): string {
  return getDisplayInitials(name, email);
}

export function deriveFirstName(
  fullName?: string | null,
  email?: string | null
): string {
  const trimmedName = fullName?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    const first = parts[0];
    if (first && first.length > 0) {
      return first.charAt(0).toUpperCase() + first.slice(1);
    }
  }

  const cleanEmail = email?.trim() || "";
  const localPart = cleanEmail.split("@")[0] || "";
  if (!localPart) {
    return "User";
  }

  const firstToken = localPart.split(/[.\-_\d]+/)[0] || localPart;
  if (!firstToken) {
    return "User";
  }

  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

function deriveUsername(displayName: string, email: string): string {
  const raw = displayName?.trim() || email?.split("@")[0] || "user";
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || "user"
  );
}

export function buildAccountProfile(
  session: Partial<AuthSession> | null | undefined,
  fallback?: Partial<AuthSession> | null
): AccountProfile {
  const email = session?.email || fallback?.email || "";
  const rawName = session?.name || fallback?.name;
  const displayName = deriveFirstName(rawName, email);

  const avatarUrl = session?.avatar || fallback?.avatar || "";
  const username =
    session?.username ||
    fallback?.username ||
    deriveUsername(displayName, email);

  return {
    avatarUrl,
    displayName,
    email,
    initials: getInitials(displayName, email),
    username,
  };
}

export function buildGoogleAuthState(
  session?: Partial<AuthSession> | null,
  connected = false,
  statusOverride?: GoogleAuthState["status"]
): GoogleAuthState {
  const email = session?.email || "";
  const resolvedConnected = connected || Boolean(session?.email);
  const status =
    statusOverride ||
    (resolvedConnected ? "connected" : session ? "not-connected" : "loading");

  return {
    connected: resolvedConnected && status !== "error",
    email: email || undefined,
    label: "Google Account",
    showGitHub: false,
    status,
  };
}

function readStoredProfile(
  session: AuthSession | null
): Partial<AccountProfile> | null {
  if (typeof window === "undefined" || !session) {
    return null;
  }
  const stored = safeJsonParse<Partial<AccountProfile>>(
    localStorage.getItem(`${PROFILE_STORAGE_KEY}:${session.user_id}`)
  );
  if (stored) {
    return stored;
  }
  const legacy = safeJsonParse<Partial<AccountProfile>>(
    localStorage.getItem(PROFILE_STORAGE_KEY)
  );
  return legacy?.email === session.email ? legacy : null;
}

function persistProfile(profile: AccountProfile, userId: string) {
  const serialized = JSON.stringify(profile);
  localStorage.setItem(PROFILE_STORAGE_KEY, serialized);
  localStorage.setItem(`${PROFILE_STORAGE_KEY}:${userId}`, serialized);
  window.dispatchEvent(new Event("storage"));
}

export async function signOutAccount(onSignedOut?: () => Promise<void>) {
  await useAuthStore.getState().logout();
  await onSignedOut?.();
  localStorage.removeItem(PROFILE_STORAGE_KEY);
  window.dispatchEvent(new Event("storage"));
  usePanelStore.getState().closePanel();
}

export function AccountPanelContent({
  authSession,
  googleAuthState,
  setSession,
  onSignedOut,
}: {
  authSession: AuthSession | null;
  googleAuthState: GoogleAuthState;
  setSession: (session: AuthSession | null) => void;
  onSignedOut?: () => Promise<void>;
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [storedProfile] = useState(() => readStoredProfile(authSession));
  const resolvedProfile = useMemo(() => {
    const base = buildAccountProfile(authSession, {
      name: storedProfile?.displayName,
      avatar: storedProfile?.avatarUrl,
      username: storedProfile?.username,
      email: storedProfile?.email,
    });
    return {
      ...base,
      avatarUrl: storedProfile?.avatarUrl ?? base.avatarUrl,
      username: storedProfile?.username?.trim() || base.username,
    };
  }, [authSession, storedProfile]);
  const [username, setUsername] = useState(resolvedProfile.username);
  const [savedUsername, setSavedUsername] = useState(resolvedProfile.username);
  const [avatarUrl, setAvatarUrl] = useState(resolvedProfile.avatarUrl);
  const [savedAvatar, setSavedAvatar] = useState(resolvedProfile.avatarUrl);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cropReady, setCropReady] = useState(false);
  const hasChanges =
    username.trim() !== savedUsername || avatarUrl !== savedAvatar;
  const isUsernameInvalid = !/^[a-zA-Z0-9_]{1,24}$/.test(username.trim());

  useEffect(() => {
    if (!imageToCrop) {
      return;
    }
    return () => URL.revokeObjectURL(imageToCrop);
  }, [imageToCrop]);

  const saveProfile = async () => {
    if (!authSession || isUsernameInvalid) {
      return;
    }
    setBusy("profile");
    try {
      const trimmed = username.trim();
      const nextAvatar = avatarUrl;
      const nextProfile = {
        ...resolvedProfile,
        username: trimmed,
        avatarUrl: nextAvatar,
      };
      persistProfile(nextProfile, authSession.user_id);
      setSession({ ...authSession, username: trimmed, avatar: nextAvatar });
      setSavedUsername(trimmed);
      setSavedAvatar(nextAvatar);
      setUsername(trimmed);
      setAvatarUrl(nextAvatar);
    } catch (error) {
      toast.error(
        getAccountError(error, "Could not save your profile. Try again.")
      );
    } finally {
      setBusy(null);
    }
  };

  const choosePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error("Choose a photo smaller than 2 MB.");
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropReady(false);
    setImageToCrop(URL.createObjectURL(file));
  };

  const saveCrop = async () => {
    if (!(imageToCrop && croppedAreaPixels)) {
      return;
    }
    setBusy("crop");
    try {
      setAvatarUrl(await getCroppedImg(imageToCrop, croppedAreaPixels));
      setImageToCrop(null);
    } catch {
      toast.error("Could not read this photo. Try a different image.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 text-foreground">
      <header className="space-y-2">
        <h2 className="font-semibold text-xl tracking-tight">Account</h2>
        <p className="text-sm text-muted-foreground">
          Your profile and sign-in method.
        </p>
      </header>
      <section aria-labelledby="account-profile-title" className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 shrink-0">
            <AvatarImage
              alt={`${resolvedProfile.displayName}'s photo`}
              className="object-cover"
              src={avatarUrl}
            />
            <AvatarFallback className="bg-muted font-medium text-lg">
              {resolvedProfile.initials}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <h3 className="font-medium text-sm" id="account-profile-title">
              Profile photo
            </h3>
            <div className="flex gap-2">
              <input
                accept="image/jpeg,image/png,image/webp"
                aria-label="Choose profile photo"
                className="hidden"
                disabled={!!busy}
                onChange={choosePhoto}
                ref={uploadInputRef}
                type="file"
              />
              <Button
                disabled={!!busy}
                onClick={() => uploadInputRef.current?.click()}
                size="sm"
                variant="outline"
              >
                Change photo
              </Button>
              {avatarUrl && (
                <Button
                  disabled={!!busy}
                  onClick={() => setAvatarUrl("")}
                  size="sm"
                  variant="ghost"
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, or WebP - Up to 2 MB
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              className="bg-muted/20"
              id="account-name"
              readOnly
              value={authSession?.name || resolvedProfile.displayName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-username">Display handle</Label>
            <Input
              aria-describedby="account-username-description"
              aria-invalid={isUsernameInvalid}
              disabled={!!busy}
              id="account-username"
              maxLength={24}
              onChange={(event) => setUsername(event.target.value)}
              value={username}
            />
            <p
              className="text-xs text-muted-foreground"
              id="account-username-description"
            >
              {isUsernameInvalid
                ? "Use 1-24 letters, numbers, or underscores."
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4 text-sm">
          <span className="break-all">
            {resolvedProfile.email || "No email available"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Profile edits are saved on this device.
        </p>
        {hasChanges && (
          <div className="flex justify-end gap-2">
            <Button
              disabled={!!busy}
              onClick={() => {
                setUsername(savedUsername);
                setAvatarUrl(savedAvatar);
              }}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={!!busy || isUsernameInvalid}
              onClick={saveProfile}
              size="sm"
            >
              {busy === "profile" ? "Saving..." : "Save changes"}
            </Button>
          </div>
        )}
      </section>
      <section aria-labelledby="account-signin-title" className="space-y-4">
        <h3 className="font-medium text-sm" id="account-signin-title">
          Sign-in & security
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GoogleGLogo className="size-5" />
            <div>
              <p className="text-sm font-medium">{googleAuthState.label}</p>
              <p className="text-xs text-muted-foreground">
                {googleAuthState.email || "Sign-in details unavailable"}
              </p>
            </div>
          </div>
          {googleAuthState.connected && (
            <Button
              onClick={async () => {
                try {
                  await openExternalUrl(
                    "https://myaccount.google.com/security"
                  );
                } catch {
                  toast.error("Could not open your browser.");
                }
              }}
              size="sm"
              variant="outline"
            >
              Google security
            </Button>
          )}
        </div>
      </section>
      <section
        aria-labelledby="account-device-title"
        className="space-y-4 border-t border-border pt-6"
      >
        <h3 className="font-medium text-sm" id="account-device-title">
          This device
        </h3>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Monitor className="size-4 text-muted-foreground" />
            <p className="text-sm">{detectDeviceName()}</p>
          </div>
          <Button
            disabled={!!busy}
            onClick={async () => {
              setBusy("sign-out");
              try {
                await signOutAccount(onSignedOut);
              } catch (error) {
                toast.error(
                  getAccountError(error, "Could not sign out. Try again.")
                );
              } finally {
                setBusy(null);
              }
            }}
            size="sm"
            variant="outline"
          >
            {busy === "sign-out" ? "Signing out..." : "Sign out this device"}
          </Button>
        </div>
      </section>
      <Dialog
        onOpenChange={(open) => {
          if (!open && busy !== "crop") {
            setImageToCrop(null);
          }
        }}
        open={!!imageToCrop}
      >
        <DialogContent
          className="sm:max-w-md bg-popover"
          showCloseButton={busy !== "crop"}
        >
          <DialogHeader>
            <DialogTitle>Adjust photo</DialogTitle>
            <DialogDescription>
              Position your photo, then save your profile changes.
            </DialogDescription>
          </DialogHeader>
          <div
            className="relative h-64 overflow-hidden rounded-lg bg-muted"
            onAnimationEnd={() => setCropReady(true)}
          >
            {imageToCrop && (
              <Cropper
                aspect={1}
                crop={crop}
                cropShape="round"
                image={imageToCrop}
                mediaProps={{
                  onError: () => {
                    setImageToCrop(null);
                    toast.error(
                      "This photo cannot be read. Choose another image."
                    );
                  },
                }}
                onCropChange={setCrop}
                onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
                onMediaLoaded={() => setCropReady(true)}
                onZoomChange={setZoom}
                showGrid={false}
                zoom={zoom}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-photo-zoom">Zoom</Label>
            <input
              className="w-full accent-primary"
              disabled={!!busy}
              id="account-photo-zoom"
              max={3}
              min={1}
              onChange={(event) => setZoom(Number(event.target.value))}
              step={0.05}
              type="range"
              value={zoom}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={!!busy}
              onClick={() => setImageToCrop(null)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!!busy || !croppedAreaPixels || !cropReady}
              onClick={saveCrop}
            >
              {busy === "crop" ? "Applying..." : "Use photo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getAccountError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function AccountPanel() {
  const authSession = useAuthStore((s) => s.session);
  const authLoaded = useAuthStore((s) => s.isLoaded);
  const setSession = useAuthStore((s) => s.setSession);

  const googleAuthState = useMemo(() => {
    if (!authLoaded) {
      return buildGoogleAuthState(authSession, false, "loading");
    }
    if (!authSession) {
      return buildGoogleAuthState(authSession, false, "not-connected");
    }
    return buildGoogleAuthState(authSession, true);
  }, [authLoaded, authSession]);

  return (
    <AccountPanelContent
      authSession={authSession}
      googleAuthState={googleAuthState}
      key={authSession?.user_id || "signed-out"}
      setSession={setSession}
    />
  );
}
