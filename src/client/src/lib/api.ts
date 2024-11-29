import { InsertFeeding, InsertSleep, type Feeding, type Sleep } from "@db/schema";

const API_BASE = "/api";

export async function fetchFeedings() {
  const response = await fetch(`${API_BASE}/feedings`);
  if (!response.ok) throw new Error("Failed to fetch feedings");
  return response.json();
}

export async function createFeeding(feeding: InsertFeeding) {
  try {
    console.log('Making API request to create feeding:', feeding);
    const response = await fetch(`${API_BASE}/feedings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(feeding),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Failed to create feeding: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('API response:', data);
    return data;
  } catch (error) {
    console.error('API error:', error);
    throw error instanceof Error ? error : new Error('Failed to create feeding');
  }
}

export async function updateFeeding(id: number, feeding: Partial<Feeding>) {
  const response = await fetch(`${API_BASE}/feedings/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(feeding),
  });
  if (!response.ok) throw new Error("Failed to update feeding");
  return response.json();
}

export async function deleteFeeding(id: number) {
  const response = await fetch(`${API_BASE}/feedings/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete feeding");
  return response.json();
}

export async function fetchSleepLogs() {
  const response = await fetch(`${API_BASE}/sleep`);
  if (!response.ok) throw new Error("Failed to fetch sleep logs");
  return response.json();
}

export async function createSleepLog(sleep: InsertSleep) {
  const response = await fetch(`${API_BASE}/sleep`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sleep),
  });
  if (!response.ok) throw new Error("Failed to create sleep log");
  return response.json();
}

export async function updateSleepLog(id: number, sleep: Partial<Sleep>) {
  const response = await fetch(`${API_BASE}/sleep/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sleep),
  });
  if (!response.ok) throw new Error("Failed to update sleep log");
  return response.json();
}

export async function deleteSleepLog(id: number) {
  const response = await fetch(`${API_BASE}/sleep/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete sleep log");
  return response.json();
}
