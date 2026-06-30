// src/lib/airtable.js
// Thin wrapper around the Airtable REST API.
// For production, consider moving these calls behind a serverless function (/api)
// so the token is never exposed to the browser. For now this calls Airtable
// directly from the frontend for simplicity during development.

const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID
const TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN

function authHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function apiRoot(tableName) {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableName)}`
}

// Fetch all records from a given table
export async function fetchRecords(tableName) {
  const res = await fetch(apiRoot(tableName), { headers: authHeaders() })
  if (!res.ok) throw new Error(`Airtable fetch failed: ${res.status}`)
  const data = await res.json()
  return data.records // [{ id, fields, createdTime }, ...]
}

// Create a single record
export async function createRecord(tableName, fields) {
  const res = await fetch(apiRoot(tableName), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`Airtable create failed: ${res.status}`)
  return res.json()
}

// Create multiple records at once (useful after parsing an uploaded file, max 10 per call)
export async function createRecordsBulk(tableName, recordsFieldsArray) {
  const res = await fetch(apiRoot(tableName), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      records: recordsFieldsArray.map((fields) => ({ fields })),
    }),
  })
  if (!res.ok) throw new Error(`Airtable bulk create failed: ${res.status}`)
  return res.json()
}

// Update a record
export async function updateRecord(tableName, recordId, fields) {
  const res = await fetch(`${apiRoot(tableName)}/${recordId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`Airtable update failed: ${res.status}`)
  return res.json()
}

// Delete a record
export async function deleteRecord(tableName, recordId) {
  const res = await fetch(`${apiRoot(tableName)}/${recordId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Airtable delete failed: ${res.status}`)
  return res.json()
}