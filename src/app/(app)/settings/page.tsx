"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWorkspace } from "@/components/workspace";
import { isManager } from "@/lib/roles";

export default function SettingsIndex() {
  const router = useRouter();
  const { member } = useWorkspace();
  const manager = isManager(member.role);
  useEffect(() => router.replace(manager ? "/settings/general" : "/settings/account"), [router, manager]);
  return null;
}
