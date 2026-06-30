// src/components/RecordTable.jsx
import { useEffect, useState } from 'react'
import { fetchRecords, updateRecord, deleteRecord } from '../lib/airtable'

export default function RecordTable({ tableName }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [tableName])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRecords(tableName)
      setRecords(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleFieldChange(recordId, fieldName, value) {
    // Update UI optimistically first
    setRecords((prev) =>
        prev.map((r) =>
            r.id === recordId ? { ...r, fields: { ...r.fields, [fieldName]: value } } : r
        )
    )
    try {
      await updateRecord(tableName, recordId, { [fieldName]: value })
    } catch (err) {
      setError(err.message)
      load() // Reload from server if the update failed
    }
  }

  async function handleDelete(recordId) {
    if (!confirm('Delete this record?')) return
    try {
      await deleteRecord(tableName, recordId)
      setRecords((prev) => prev.filter((r) => r.id !== recordId))
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>
  if (records.length === 0) return <p>No records found.</p>

  // Field names are derived from the first record (adjust to match your actual table columns)
  const fieldNames = Object.keys(records[0].fields)

  return (
      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
        <tr>
          {fieldNames.map((name) => (
              <th key={name}>{name}</th>
          ))}
          <th>Delete</th>
        </tr>
        </thead>
        <tbody>
        {records.map((record) => (
            <tr key={record.id}>
              {fieldNames.map((name) => (
                  <td key={name}>
                    <input
                        value={record.fields[name] ?? ''}
                        onChange={(e) => handleFieldChange(record.id, name, e.target.value)}
                    />
                  </td>
              ))}
              <td>
                <button onClick={() => handleDelete(record.id)}>Delete</button>
              </td>
            </tr>
        ))}
        </tbody>
      </table>
  )
}