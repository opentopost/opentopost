"use client";

import { LoginLink, RegisterLink } from "@kinde-oss/kinde-auth-nextjs/components";
import type { ReactNode } from "react";
import { buttonClass } from "../ui";

/* The open-source copy has no demo mode, so these are plain Start free and Sign in buttons. */

export function readAccess(): string | null {
  return null;
}

export function readHasAccount(): boolean {
  return false;
}

export function saveHasAccount() {}

export function saveAccess(_code: string) {}

export function useSiteGate() {
  return { loading: false, demo: false, access: null as string | null, hasAccount: false, returning: false };
}

type Size = "sm" | "md" | "lg";
type Variant = "primary" | "secondary" | "ghost" | "dark";

export function StartCta({
  children,
  postLoginRedirectURL = "/dashboard",
  size = "md",
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  postLoginRedirectURL?: string;
  size?: Size;
  variant?: Variant;
  className?: string;
  demoHidden?: boolean;
}) {
  return (
    <RegisterLink postLoginRedirectURL={postLoginRedirectURL} className={buttonClass(variant, size, className)}>
      {children}
    </RegisterLink>
  );
}

export function SignInCta({
  size = "sm",
  variant = "ghost",
  className = "",
  children = "Sign in",
}: {
  size?: Size;
  variant?: Variant;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <LoginLink postLoginRedirectURL="/dashboard" className={buttonClass(variant, size, className)}>
      {children}
    </LoginLink>
  );
}
