import { useEffect, useState } from "react";
import { api } from "./api";

export function useMe() {
  const [me, setMe] = useState<{ email: string; role: "propietario" | "colaborador" } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  return { me, loading, isOwner: me?.role === "propietario" };
}
