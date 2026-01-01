// lib/activity-tracker.ts
// Utility untuk tracking user activity

export type ActivityType = "document_processed" | "query_made" | "profile_updated";

export type Activity = {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: number; // milliseconds
  metadata?: {
    documentName?: string;
    queryText?: string;
  };
};

function getActivityKey(userId: string | null): string {
  return userId ? `user_activities_${userId}` : "user_activities_guest";
}

export function addActivity(
  userId: string | null,
  type: ActivityType,
  message: string,
  metadata?: Activity["metadata"]
): void {
  try {
    const key = getActivityKey(userId);
    const activities: Activity[] = JSON.parse(localStorage.getItem(key) || "[]");
    
    const activity: Activity = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: Date.now(),
      metadata,
    };
    
    activities.unshift(activity); // Add to beginning
    const limited = activities.slice(0, 50); // Keep last 50 activities
    
    localStorage.setItem(key, JSON.stringify(limited));
  } catch (e) {
    console.error("Error adding activity:", e);
  }
}

export function getActivities(userId: string | null): Activity[] {
  try {
    const key = getActivityKey(userId);
    const activities: Activity[] = JSON.parse(localStorage.getItem(key) || "[]");
    return activities;
  } catch (e) {
    console.error("Error getting activities:", e);
    return [];
  }
}

export function getFirstActivityDate(userId: string | null): number | null {
  const activities = getActivities(userId);
  if (activities.length === 0) return null;
  
  // Get the oldest activity timestamp
  const timestamps = activities.map(a => a.timestamp);
  return Math.min(...timestamps);
}

export function getDaysActive(userId: string | null): number {
  const firstDate = getFirstActivityDate(userId);
  if (!firstDate) return 0;
  
  const daysDiff = Math.floor((Date.now() - firstDate) / (1000 * 60 * 60 * 24));
  return Math.max(1, daysDiff + 1); // At least 1 day
}

