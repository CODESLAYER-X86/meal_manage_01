"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

// Utility function to convert VAPID key
function urlB64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationSetup() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setLoading(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error("Error checking subscription:", err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToPush = async () => {
    setError("");
    setLoading(true);

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Worker not supported");
      }

      const registration = await navigator.serviceWorker.ready;

      // 1. Get VAPID key from backend
      const vapidRes = await fetch("/api/web-push/vapid");
      const { publicKey } = await vapidRes.json();
      
      if (!publicKey) {
        throw new Error("Push notifications not configured on server");
      }

      // 2. Ask for browser permission & subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey),
      });

      // 3. Send subscription to our API
      const res = await fetch("/api/web-push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      if (!res.ok) throw new Error("Failed to save subscription");

      setIsSubscribed(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setError("");
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe in browser
        await subscription.unsubscribe();

        // Delete from backend
        await fetch(`/api/web-push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: "DELETE",
        });
      }

      setIsSubscribed(false);
    } catch (err: any) {
      console.error(err);
      setError("Failed to disable notifications");
    } finally {
      setLoading(false);
    }
  };

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null; // Don't show if unsupported (e.g. iOS missing features if not installed)
  }

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 rounded-xl shadow-md flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
          {isSubscribed ? <Bell className="text-emerald-400 w-5 h-5" /> : <BellOff className="text-slate-400 w-5 h-5" />}
          Push Notifications
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {isSubscribed 
            ? "You will receive alerts for meals and announcements." 
            : "Enable to get lock-screen alerts before meals lock."}
        </p>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      <button
        onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
        disabled={loading}
        className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition ${
          isSubscribed 
            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" 
            : "bg-indigo-600 text-white hover:bg-indigo-700"
        } disabled:opacity-50`}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {isSubscribed ? "Disable" : "Enable"}
      </button>
    </div>
  );
}
