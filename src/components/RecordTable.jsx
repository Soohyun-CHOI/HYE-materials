// src/components/RecordTable.jsx
import { useEffect, useState } from 'react'
import { fetchRecords } from '../lib/airtable'

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
            </tr>
            </thead>
            <tbody>
            {records.map((record) => (
                <tr key={record.id}>
                    {fieldNames.map((name) => (
                        <td key={name}>{String(record.fields[name] ?? '')}</td>
                    ))}
                </tr>
            ))}
            </tbody>
        </table>
    )
}