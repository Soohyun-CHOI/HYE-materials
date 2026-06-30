// src/App.jsx
import RecordTable from './components/RecordTable'

const TABLE_NAME = 'test' // Replace with your actual table name in the Testing base

function App() {
    return (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
            <h1>Airtable Dashboard</h1>
            <RecordTable tableName={TABLE_NAME} />
        </div>
    )
}

export default App