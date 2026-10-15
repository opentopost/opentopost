"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Start() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
}
