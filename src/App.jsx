// src/App.jsx
import { useEffect, useState } from 'react'
import RecordTable from './components/RecordTable/RecordTable.jsx'
import SearchTable from './components/SearchTable/SearchTable.jsx'
import { fetchRecords } from './lib/airtable'

const TABLE_NAME = 'test'

function App() {
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetchRecords(TABLE_NAME)
            .then(setRecords)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <p>Loading...</p>
    if (error) return <p style={{ color: 'red' }}>Error: {error}</p>

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
            <h1>Airtable Dashboard</h1>

            <SearchTable records={records} />
            <RecordTable records={records} />
        </div>
    )
}

export default App